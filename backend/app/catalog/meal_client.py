# backend/app/catalog/meal_client.py
"""Async client for TheMealDB (free, no key). Used by /recipes/* (M4)."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import MEALDB_BASE_URL

log = logging.getLogger(__name__)

USER_AGENT = "SmartGroceryLite/1.0 (mealdb)"


async def _get(client: httpx.AsyncClient, path: str, params: Optional[dict] = None) -> Optional[dict]:
    try:
        r = await client.get(f"{MEALDB_BASE_URL}{path}", params=params, headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning("TheMealDB %s failed: %s", path, e)
        return None


async def search_by_name(client: httpx.AsyncClient, q: str) -> list[dict]:
    if not q.strip():
        return []
    data = await _get(client, "/search.php", {"s": q})
    if not data:
        return []
    return [
        {
            "external_id": str(m.get("idMeal") or ""),
            "title": m.get("strMeal") or "",
            "image_url": m.get("strMealThumb"),
            "category": m.get("strCategory"),
            "area": m.get("strArea"),
            "source_url": (m.get("strSource") or m.get("strYoutube")),
        }
        for m in (data.get("meals") or []) if m.get("idMeal")
    ]


async def search_by_ingredient(client: httpx.AsyncClient, ingredient: str) -> list[dict]:
    data = await _get(client, "/filter.php", {"i": ingredient})
    if not data:
        return []
    return [
        {
            "external_id": str(m.get("idMeal") or ""),
            "title": m.get("strMeal") or "",
            "image_url": m.get("strMealThumb"),
            "category": None,
            "area": None,
            "source_url": None,
        }
        for m in (data.get("meals") or []) if m.get("idMeal")
    ]


async def lookup(client: httpx.AsyncClient, external_id: str) -> Optional[dict]:
    data = await _get(client, "/lookup.php", {"i": external_id})
    if not data:
        return None
    meals = data.get("meals") or []
    if not meals:
        return None
    m = meals[0]
    # Parse ings 1..20
    ingredients: list[dict] = []
    for i in range(1, 21):
        name = (m.get(f"strIngredient{i}") or "").strip()
        measure = (m.get(f"strMeasure{i}") or "").strip()
        if not name:
            continue
        ingredients.append({
            "name": name,
            "measure": measure or None,
            "original": f"{measure} {name}".strip(),
            "aisle": (m.get("strCategory") or None),
            "position": i - 1,
        })
    return {
        "external_id": str(m.get("idMeal") or ""),
        "title": m.get("strMeal") or "",
        "image_url": m.get("strMealThumb"),
        "source_url": (m.get("strSource") or m.get("strYoutube")),
        "category": m.get("strCategory"),
        "area": m.get("strArea"),
        "summary": None,
        "servings": None,
        "ready_minutes": None,
        "ingredients": ingredients,
    }
