# backend/app/routers/catalog.py
"""Aggregator router for product catalog lookups.

Combines Open Food Facts (always) with Kroger (when the user has connected
a store and KROGER_CLIENT_ID/SECRET are set). All responses are normalized
to CatalogProductRead and cached server-side via ProductCache.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import CATALOG_CACHE_TTL_HOURS, kroger_configured
from app.deps import get_current_user_any as get_current_user
from app.models import ConnectedStore, ProductCache, TaxonomyEntry, User
from app.catalog import off_client, kroger_client
from app.catalog.rate_limit import catalog_limiter
from app.catalog.taxonomy import get_cached_taxonomy
from app.schemas import (
    CatalogProductRead,
    CategoryNode,
    ConnectedStoreRead,
    RecipeAddToListResponse,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/catalog", tags=["catalog"])


# ---- helpers ----

def _cache_key(source: str, endpoint: str, params: dict) -> str:
    norm = json.dumps(params, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(f"{source}|{endpoint}|{norm}".encode("utf-8")).hexdigest()


def _cache_get(db: Session, key: str) -> Optional[list | dict]:
    row = db.get(ProductCache, key)
    if not row:
        return None
    age = datetime.now(timezone.utc) - row.fetched_at
    if age > timedelta(hours=CATALOG_CACHE_TTL_HOURS):
        return None
    return row.payload


def _cache_put(db: Session, key: str, source: str, endpoint: str, payload) -> None:
    try:
        row = db.get(ProductCache, key)
        if row is None:
            row = ProductCache(key=key, source=source, endpoint=endpoint, payload=payload)
            db.add(row)
        else:
            row.payload = payload
            row.fetched_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        log.warning("cache_put failed: %s", e)
        db.rollback()


def _get_connected_store(db: Session, user_id: int) -> Optional[ConnectedStore]:
    return db.execute(
        select(ConnectedStore).where(ConnectedStore.user_id == user_id).order_by(ConnectedStore.connected_at.desc())
    ).scalars().first()


async def _throttle(scope: str, key: str, response: Response) -> None:
    allowed, retry = catalog_limiter().allow(scope, key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Catalog rate limit exceeded",
            headers={"Retry-After": str(int(retry) + 1)},
        )


# ---- endpoints ----

@router.get("/search", response_model=list[CatalogProductRead])
async def search(
    request: Request,
    q: str = Query("", max_length=120),
    category: Optional[str] = Query(None, max_length=64),
    page: int = Query(1, ge=1, le=20),
    page_size: int = Query(10, ge=1, le=30),
    use_kroger: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (q or "").strip()
    if not q:
        return []
    await _throttle("search", str(current_user.id), Response())

    client = request.app.state.http
    out: list[dict] = []
    seen_codes: set[str] = set()

    # OFF (cached)
    off_params = {"q": q, "page": page, "page_size": page_size}
    off_key = _cache_key("off", "search", off_params)
    cached = _cache_get(db, off_key)
    if cached is not None:
        off_results = cached
    else:
        off_results = await off_client.search(client, q=q, page=page, page_size=page_size)
        _cache_put(db, off_key, "off", "search", off_results)

    for p in off_results:
        if category and (p.get("canonical") or "").split(".")[0] != category:
            continue
        if p.get("code") and p["code"] in seen_codes:
            continue
        if p.get("code"):
            seen_codes.add(p["code"])
        out.append(p)

    # Kroger (only if configured, user opted in, and has a connected store)
    if use_kroger and kroger_configured():
        store = _get_connected_store(db, current_user.id)
        if store:
            kroger_params = {"q": q, "page": page, "page_size": page_size, "location_id": store.location_id}
            kkey = _cache_key("kroger", "search", kroger_params)
            kc = _cache_get(db, kkey)
            if kc is not None:
                kroger_results = kc
            else:
                kroger_results = await kroger_client.search_products(
                    client, term=q, location_id=store.location_id, limit=page_size
                )
                _cache_put(db, kkey, "kroger", "search", kroger_results)

            for p in kroger_results:
                if p.get("code") and p["code"] in seen_codes:
                    continue
                if p.get("code"):
                    seen_codes.add(p["code"])
                if category and (p.get("canonical") or "").split(".")[0] != category:
                    continue
                out.append(p)

    return out[: max(1, min(50, page_size))]


@router.get("/barcode/{ean}", response_model=Optional[CatalogProductRead])
async def barcode(
    ean: str,
    request: Request,
    use_kroger: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ean = ean.strip()
    if not ean or not ean.isdigit() or not (8 <= len(ean) <= 14):
        raise HTTPException(status_code=400, detail="Invalid barcode")
    await _throttle("barcode", str(current_user.id), Response())

    client = request.app.state.http

    # OFF first
    off_params = {"ean": ean}
    off_key = _cache_key("off", "barcode", off_params)
    cached = _cache_get(db, off_key)
    if cached is not None:
        return cached if cached else None
    off_result = await off_client.barcode(client, ean)
    _cache_put(db, off_key, "off", "barcode", off_result or {})

    if off_result:
        return off_result

    # Kroger fallback
    if use_kroger and kroger_configured():
        store = _get_connected_store(db, current_user.id)
        if store:
            kroger_params = {"ean": ean, "location_id": store.location_id}
            kkey = _cache_key("kroger", "barcode", kroger_params)
            kc = _cache_get(db, kkey)
            if kc is not None:
                return kc if kc else None
            kr = await kroger_client.get_product(client, ean, store.location_id)
            _cache_put(db, kkey, "kroger", "barcode", kr or {})
            return kr

    return None


@router.get("/lookup", response_model=Optional[CatalogProductRead])
async def lookup(
    request: Request,
    name: str = Query(..., min_length=1, max_length=120),
    brand: Optional[str] = Query(None, max_length=120),
    use_kroger: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _throttle("lookup", str(current_user.id), Response())
    client = request.app.state.http
    results = await off_client.search(client, q=name, page=1, page_size=5)
    for p in results:
        if brand and p.get("brand") and brand.lower() not in p["brand"].lower():
            continue
        return p
    if use_kroger and kroger_configured():
        store = _get_connected_store(db, current_user.id)
        if store:
            kr = await kroger_client.search_products(client, term=name, location_id=store.location_id, limit=5)
            for p in kr:
                if brand and p.get("brand") and brand.lower() not in p["brand"].lower():
                    continue
                return p
    return None


@router.get("/categories")
def categories(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Return the taxonomy tree. Built from the bundled JSON in memory."""
    tax = get_cached_taxonomy()
    return tax.tree()


@router.post("/_seed-taxonomy", include_in_schema=False)
def seed_taxonomy(_=Depends(get_current_user), db: Session = Depends(get_db)):
    """One-shot DB seed of bundled taxonomy. Idempotent."""
    from app.catalog.taxonomy import ensure_taxonomy_in_db, get_cached_taxonomy
    ensure_taxonomy_in_db(db, get_cached_taxonomy())
    return {"ok": True, "count": db.query(TaxonomyEntry).count()}
