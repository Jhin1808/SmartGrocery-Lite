# backend/app/routers/recipes.py
"""Recipe router backed by TheMealDB.

Read endpoints in M1. "Add to list" shipped in M4: takes a recipe's
ingredients and bulk-creates ``ListItem`` rows on the target list, with
auto-categorization per ingredient.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_any as get_current_user
from app.models import GroceryList, ListItem, User
from app.catalog import meal_client
from app.catalog.auto_categorize import categorize as auto_categorize
from app.schemas import (
    RecipeAddToListResponse,
    RecipeDetailRead,
    RecipeSummaryRead,
)
from app.permissions import can_write

log = logging.getLogger(__name__)
router = APIRouter(prefix="/recipes", tags=["recipes"])

# Pull the leading integer / simple fraction out of a measure string.
# Examples: "2 cups" -> 2, "1/2 tsp" -> 0.5, "1 1/2 tbsp" -> 1.5, "3" -> 3
# Note: alternatives are ordered most-specific first so that "3/4" wins
# over the leading "3".
_FRACTION_MAP = {"¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1/3, "⅔": 2/3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875}
_QTY_RE = re.compile(
    r"^\s*(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|[¼-⅞])",
    re.IGNORECASE,
)


def _parse_quantity(measure: Optional[str]) -> int:
    """Extract an integer quantity from a free-text measure (e.g. '2 cups').
    Falls back to 1 when no number is present.
    """
    if not measure:
        return 1
    m = _QTY_RE.match(measure)
    if not m:
        return 1
    token = m.group(1).strip()
    # Unicode fraction
    if token in _FRACTION_MAP:
        return max(1, int(round(_FRACTION_MAP[token])))
    # "1 1/2"
    if " " in token and "/" in token:
        try:
            whole, frac = token.split(" ", 1)
            n, d = frac.split("/", 1)
            v = int(whole) + int(n) / int(d)
        except Exception:
            return 1
    elif "/" in token:
        try:
            n, d = token.split("/", 1)
            v = int(n) / int(d)
        except Exception:
            return 1
    else:
        try:
            v = float(token)
        except ValueError:
            return 1
    return max(1, int(round(v)))


@router.get("/search", response_model=list[RecipeSummaryRead])
async def search(
    request: Request,
    q: Optional[str] = Query(None, max_length=80),
    ingredient: Optional[str] = Query(None, max_length=80),
    _=Depends(get_current_user),
):
    client = request.app.state.http
    q = (q or "").strip() or None
    ingredient = (ingredient or "").strip() or None
    if q:
        results = await meal_client.search_by_name(client, q)
    elif ingredient:
        results = await meal_client.search_by_ingredient(client, ingredient)
    else:
        # No usable param: return empty (200) rather than 400 so the
        # front-end can render an empty state without a noisy error.
        return []
    return [RecipeSummaryRead(**r) for r in results]


@router.get("/{external_id}", response_model=RecipeDetailRead)
async def detail(external_id: str, request: Request, _=Depends(get_current_user)):
    client = request.app.state.http
    r = await meal_client.lookup(client, external_id)
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeDetailRead(**r)


@router.post(
    "/{external_id}/to-list/{list_id}",
    response_model=RecipeAddToListResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_to_list(
    external_id: str,
    list_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a recipe's ingredients and create a ``ListItem`` for each on
    the target list. Caller must have edit rights. Empty / whitespace-only
    ingredient names are reported back in ``skipped`` rather than created.
    """
    gl = db.get(GroceryList, list_id)
    if gl is None:
        raise HTTPException(status_code=404, detail="List not found")
    if not can_write(db, current_user.id, list_id):
        raise HTTPException(status_code=403, detail="You don't have edit access to this list")

    client = request.app.state.http
    r = await meal_client.lookup(client, external_id)
    if not r:
        raise HTTPException(status_code=404, detail="Recipe not found")

    ingredients = r.get("ingredients") or []
    added = 0
    skipped: list[str] = []
    for ing in ingredients:
        original_name = (ing.get("name") or "")
        name = original_name.strip()
        if not name:
            # Report the blank (or whitespace-only) value back so the caller
            # can show it in a toast.
            skipped.append(original_name)
            continue
        if len(name) > 100:
            name = name[:100]
        measure = (ing.get("measure") or "").strip() or None
        qty = _parse_quantity(measure)
        canonical, _display, hint = auto_categorize(name)
        item = ListItem(
            name=name,
            quantity=qty,
            list_id=list_id,
            description=ing.get("original") or None,
            category=canonical,
            subcategory=hint,
        )
        db.add(item)
        added += 1
    try:
        db.commit()
    except Exception as e:
        log.exception("recipe add-to-list commit failed: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Couldn't add ingredients")
    return RecipeAddToListResponse(added=added, skipped=skipped)
