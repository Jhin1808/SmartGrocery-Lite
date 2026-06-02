# backend/app/catalog/off_client.py
"""Thin async client for the Open Food Facts (OFF) public API.

Endpoints used:
  - GET {base}/cgi/search.pl   (search by term)
  - GET {base}/api/v2/product/{barcode}.json  (lookup by barcode)

All responses are normalized to `CatalogProductRead`-shaped dicts.
Network calls are wrapped in a 4s timeout and 1 retry on transient failure.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

import httpx

from app.config import OFF_BASE_URL, CATALOG_TIMEOUT_SECONDS
from app.catalog.taxonomy import Taxonomy, get_cached_taxonomy

log = logging.getLogger(__name__)

USER_AGENT = "SmartGroceryLite/1.0 (catalog)"


async def _get(client: httpx.AsyncClient, url: str, params: Optional[dict] = None) -> Optional[dict]:
    last_exc: Optional[Exception] = None
    for attempt in range(2):
        try:
            r = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()
        except (httpx.TimeoutException, httpx.TransportError) as e:
            last_exc = e
            await asyncio.sleep(0.25 * (attempt + 1))
        except Exception as e:  # pragma: no cover
            log.warning("OFF non-retryable error %s: %s", url, e)
            return None
    log.warning("OFF failed after retries: %s", last_exc)
    return None


def _normalize_product(p: dict, taxonomy: Taxonomy) -> dict:
    code = p.get("code") or p.get("id")
    name = (
        p.get("product_name")
        or p.get("product_name_en")
        or p.get("generic_name")
        or p.get("generic_name_en")
        or p.get("brands")
        or ""
    )
    brand = p.get("brands") or None
    if brand and "," in brand:
        brand = brand.split(",")[0].strip() or None
    image = p.get("image_front_small_url") or p.get("image_url") or p.get("image_front_url")
    categories = p.get("categories_tags") or p.get("categories_hierarchy") or []
    if isinstance(categories, str):
        categories = [c for c in categories.split(",") if c]
    mapped = taxonomy.map_off_categories(categories)
    canonical = mapped["canonical"] if mapped else None
    display = mapped["display"] if mapped else None

    weight_value: Optional[float] = None
    weight_unit: Optional[str] = None
    qn = p.get("product_quantity")
    qu = p.get("product_quantity_unit")
    if qn is not None:
        try:
            weight_value = float(qn)
        except (TypeError, ValueError):
            weight_value = None
    if weight_value is not None and qu:
        weight_unit = str(qu).lower()[:8]

    return {
        "source": "off",
        "code": str(code) if code else None,
        "name": name or "Unknown",
        "brand": brand,
        "image_url": image,
        "categories": list(categories)[:10],
        "canonical": canonical,
        "display": display,
        "weight_value": weight_value,
        "weight_unit": weight_unit,
        "price_regular": None,
        "price_promo": None,
        "aisle": None,
        "stock_level": None,
        "fulfillment": None,
    }


async def search(client: httpx.AsyncClient, q: str, page: int = 1, page_size: int = 10) -> list[dict]:
    if not q or not q.strip():
        return []
    url = f"{OFF_BASE_URL}/cgi/search.pl"
    params = {
        "search_terms": q,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": max(1, min(50, page_size)),
        "page": max(1, page),
        "fields": "code,product_name,product_name_en,generic_name,generic_name_en,brands,image_front_small_url,image_url,image_front_url,categories_tags,categories_hierarchy,product_quantity,product_quantity_unit",
    }
    data = await _get(client, url, params=params)
    if not data:
        return []
    taxonomy = get_cached_taxonomy()
    products = data.get("products") or []
    return [_normalize_product(p, taxonomy) for p in products if p]


async def barcode(client: httpx.AsyncClient, ean: str) -> Optional[dict]:
    ean = (ean or "").strip()
    if not ean:
        return None
    url = f"{OFF_BASE_URL}/api/v2/product/{ean}.json"
    data = await _get(client, url)
    if not data or data.get("status") not in (1, "1"):
        return None
    p = data.get("product") or {}
    taxonomy = get_cached_taxonomy()
    return _normalize_product(p, taxonomy)
