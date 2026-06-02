# backend/app/routers/stores.py
"""Store connection router. v1 supports Kroger-family stores only.

A user "connects" a store by choosing a location from a Kroger search
result. The backend stores the (user, source, location_id) tuple in
`connected_store`. The most recently connected store is used for
catalog lookups (real prices, aisle, stock).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import kroger_configured
from app.deps import get_current_user_any as get_current_user
from app.models import ConnectedStore, User
from app.catalog import kroger_client
from app.catalog.rate_limit import catalog_limiter
from app.schemas import (
    ConnectedStoreCreate,
    ConnectedStoreRead,
    KrogerChainSummary,
    KrogerLocationSummary,
    KrogerStatusRead,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/stores", tags=["stores"])


def _to_connected_read(s: ConnectedStore) -> ConnectedStoreRead:
    return ConnectedStoreRead(
        id=s.id,
        source=s.source,
        chain=s.chain,
        location_id=s.location_id,
        name=s.name,
        address=s.address,
        lat=s.lat,
        lng=s.lng,
        connected_at=s.connected_at,
    )


@router.get("/status", response_model=KrogerStatusRead)
def status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.execute(
        select(ConnectedStore).where(ConnectedStore.user_id == current_user.id)
        .order_by(ConnectedStore.connected_at.desc())
    ).scalars().first()
    return KrogerStatusRead(configured=kroger_configured(), connected_store=_to_connected_read(row) if row else None)


@router.get("/chains", response_model=list[KrogerChainSummary])
async def chains(request: Request, _=Depends(get_current_user)):
    if not kroger_configured():
        return []
    client = request.app.state.http
    return [KrogerChainSummary(**c) for c in await kroger_client.list_chains(client)]


@router.get("/search", response_model=list[KrogerLocationSummary])
async def search(
    request: Request,
    zip: Optional[str] = Query(None, max_length=10),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    radius: int = Query(10, ge=1, le=50),
    limit: int = Query(10, ge=1, le=30),
    chain: Optional[str] = Query(None, max_length=40),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not zip and (lat is None or lng is None):
        raise HTTPException(status_code=400, detail="Provide zip or lat+lng")
    if not kroger_configured():
        return []
    allowed, retry = catalog_limiter().allow("stores_search", str(current_user.id))
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit", headers={"Retry-After": str(int(retry) + 1)})
    client = request.app.state.http
    rows = await kroger_client.search_locations(
        client,
        zip_code=zip,
        lat=lat,
        lng=lng,
        radius_miles=radius,
        limit=limit,
        chain=chain,
    )
    return [KrogerLocationSummary(**r) for r in rows]


@router.get("/connected", response_model=Optional[ConnectedStoreRead])
def get_connected(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.execute(
        select(ConnectedStore).where(ConnectedStore.user_id == current_user.id)
        .order_by(ConnectedStore.connected_at.desc())
    ).scalars().first()
    return _to_connected_read(row) if row else None


@router.post("/connect", response_model=ConnectedStoreRead, status_code=201)
def connect(
    payload: ConnectedStoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Replace any existing row for this user (one connected store per user for v1)
    existing = db.execute(
        select(ConnectedStore).where(ConnectedStore.user_id == current_user.id)
    ).scalars().all()
    for s in existing:
        db.delete(s)
    row = ConnectedStore(
        user_id=current_user.id,
        source="kroger",
        chain=payload.chain,
        location_id=payload.location_id,
        name=payload.name,
        address=payload.address,
        lat=payload.lat,
        lng=payload.lng,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_connected_read(row)


@router.delete("/connected", status_code=204)
def disconnect(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.execute(
        select(ConnectedStore).where(ConnectedStore.user_id == current_user.id)
    ).scalars().all()
    for s in rows:
        db.delete(s)
    db.commit()
    return Response(status_code=204)
