# backend/app/catalog/kroger_client.py
"""Async client for the Kroger Public API (https://developer.kroger.com).

Uses the OAuth2 **client-credentials** grant (public tier). No per-user
login to Kroger is required; we just cache an app-level access token and
use it to call:
  - POST /v1/connect/oauth2/token            (token)
  - GET  /v1/products                         (search)
  - GET  /v1/products/{upc}                   (barcode)
  - GET  /v1/locations                        (store search)
  - GET  /v1/chains                           (banner list)

Pricing requires passing `filter.locationId`. The user connects a store
once (see ConnectedStore model) and the backend passes that locationId on
every product lookup.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Optional

import httpx

from app.config import (
    KROGER_BASE_URL,
    KROGER_CLIENT_ID,
    KROGER_CLIENT_SECRET,
    KROGER_SCOPES,
    KROGER_TOKEN_CACHE_TTL_SECONDS,
    CATALOG_TIMEOUT_SECONDS,
    kroger_configured,
)
from app.catalog.taxonomy import Taxonomy, get_cached_taxonomy

log = logging.getLogger(__name__)

USER_AGENT = "SmartGroceryLite/1.0 (kroger)"


# ---- Token cache (process-global) ----

_token: dict = {"value": None, "expires_at": 0.0}
_token_lock = asyncio.Lock()


async def _fetch_token(client: httpx.AsyncClient) -> Optional[str]:
    if not kroger_configured():
        return None
    async with _token_lock:
        now = time.time()
        if _token["value"] and _token["expires_at"] - 60 > now:
            return _token["value"]
        # basic auth header
        raw = f"{KROGER_CLIENT_ID}:{KROGER_CLIENT_SECRET}".encode("utf-8")
        auth = base64.b64encode(raw).decode("ascii")
        body = {
            "grant_type": "client_credentials",
            "scope": KROGER_SCOPES,
        }
        try:
            r = await client.post(
                f"{KROGER_BASE_URL}/v1/connect/oauth2/token",
                data=body,
                headers={
                    "Authorization": f"Basic {auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": USER_AGENT,
                },
            )
            if r.status_code != 200:
                log.warning("Kroger token failed: %s %s", r.status_code, r.text[:200])
                return None
            j = r.json()
            access = j.get("access_token")
            expires_in = int(j.get("expires_in") or KROGER_TOKEN_CACHE_TTL_SECONDS)
            _token["value"] = access
            _token["expires_at"] = now + min(expires_in, KROGER_TOKEN_CACHE_TTL_SECONDS)
            return access
        except Exception as e:
            log.warning("Kroger token exception: %s", e)
            return None


async def _authed_get(client: httpx.AsyncClient, path: str, params: Optional[dict] = None) -> Optional[dict]:
    tok = await _fetch_token(client)
    if not tok:
        return None
    try:
        r = await client.get(
            f"{KROGER_BASE_URL}{path}",
            params=params,
            headers={
                "Authorization": f"Bearer {tok}",
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )
        if r.status_code == 401:
            # token may have been revoked; clear cache and retry once
            _token["value"] = None
            tok = await _fetch_token(client)
            if not tok:
                return None
            r = await client.get(
                f"{KROGER_BASE_URL}{path}",
                params=params,
                headers={
                    "Authorization": f"Bearer {tok}",
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                },
            )
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning("Kroger GET %s failed: %s", path, e)
        return None


def _normalize_product(item: dict, taxonomy: Taxonomy, location_id: Optional[str]) -> dict:
    pid = item.get("productId") or item.get("upc")
    desc = item.get("description") or item.get("name") or ""
    brand = item.get("brand") or None
    image = (item.get("images") or [{}])[0].get("sizes", [{}])[0].get("url") if item.get("images") else None
    categories = [c for c in (item.get("categories") or []) if c]
    # If Kroger gives categories, try to find a taxonomy match by name
    canonical = None
    display = None
    if categories:
        # Build a one-off slug guess
        guess = "en:" + "-".join(categories[0].lower().split())
        entry = taxonomy.by_slug.get(guess)
        if entry:
            canonical = entry["canonical"]
            display = entry["display"]
    # Pricing block
    price_regular = None
    price_promo = None
    price_block = item.get("price") if location_id else (item.get("nationalPrice") or item.get("price"))
    if isinstance(price_block, dict):
        try:
            if price_block.get("regular") is not None:
                price_regular = float(price_block["regular"])
        except (TypeError, ValueError):
            price_regular = None
        try:
            if price_block.get("promo") is not None:
                price_promo = float(price_block["promo"])
        except (TypeError, ValueError):
            price_promo = None
    # Aisle
    aisle = None
    for al in item.get("aisleLocations") or []:
        if al.get("description"):
            aisle = al["description"]
            break
    # Fulfillment
    fulfillment = item.get("fulfillment") if location_id else None
    stock_level = None
    inv = item.get("inventory")
    if isinstance(inv, dict) and inv.get("stockLevel"):
        stock_level = inv["stockLevel"]

    return {
        "source": "kroger",
        "code": str(pid) if pid else None,
        "name": desc or "Unknown",
        "brand": brand,
        "image_url": image,
        "categories": categories[:10],
        "canonical": canonical,
        "display": display,
        "weight_value": None,
        "weight_unit": None,
        "price_regular": price_regular,
        "price_promo": price_promo,
        "aisle": aisle,
        "stock_level": stock_level,
        "fulfillment": fulfillment,
    }


async def search_products(
    client: httpx.AsyncClient,
    term: str,
    location_id: Optional[str] = None,
    limit: int = 10,
) -> list[dict]:
    if not kroger_configured() or not term.strip():
        return []
    params: dict = {
        "filter.term": term,
        "filter.limit": max(1, min(50, limit)),
    }
    if location_id:
        params["filter.locationId"] = location_id
    data = await _authed_get(client, "/v1/products", params=params)
    if not data:
        return []
    taxonomy = get_cached_taxonomy()
    items = data.get("data") or []
    return [_normalize_product(i, taxonomy, location_id) for i in items]


async def get_product(
    client: httpx.AsyncClient,
    upc: str,
    location_id: Optional[str] = None,
) -> Optional[dict]:
    if not kroger_configured() or not upc.strip():
        return None
    params: dict = {}
    if location_id:
        params["filter.locationId"] = location_id
    data = await _authed_get(client, f"/v1/products/{upc}", params=params)
    if not data:
        return None
    items = data.get("data") or []
    if not items:
        return None
    taxonomy = get_cached_taxonomy()
    return _normalize_product(items[0], taxonomy, location_id)


async def list_chains(client: httpx.AsyncClient) -> list[dict]:
    if not kroger_configured():
        return []
    data = await _authed_get(client, "/v1/chains")
    if not data:
        return []
    out: list[dict] = []
    for c in data.get("data") or []:
        out.append({"name": c.get("name"), "location_count": c.get("locationCount")})
    return out


async def search_locations(
    client: httpx.AsyncClient,
    zip_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_miles: int = 10,
    limit: int = 10,
    chain: Optional[str] = None,
) -> list[dict]:
    if not kroger_configured():
        return []
    params: dict = {"filter.limit": max(1, min(50, limit)), "filter.radiusInMiles": max(1, min(50, radius_miles))}
    if zip_code:
        params["filter.zipCode.near"] = zip_code
    elif lat is not None and lng is not None:
        params["filter.latLong.near"] = f"{lat},{lng}"
    if chain:
        params["filter.chain"] = chain
    data = await _authed_get(client, "/v1/locations", params=params)
    if not data:
        return []
    out: list[dict] = []
    for l in data.get("data") or []:
        addr = l.get("address") or {}
        line = ", ".join([addr.get("addressLine1") or "", addr.get("city") or "", addr.get("state") or "", addr.get("zipCode") or ""]).strip(", ")
        out.append({
            "location_id": str(l.get("locationId") or ""),
            "chain": l.get("chain") or "",
            "name": l.get("name") or "",
            "address": line or None,
            "lat": (l.get("geolocation") or {}).get("latitude"),
            "lng": (l.get("geolocation") or {}).get("longitude"),
            "zip": addr.get("zipCode"),
        })
    return out
