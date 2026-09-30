from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_any
from app.models import FridgeItem, User

router = APIRouter(prefix="/fridge", tags=["fridge"])


class FridgeInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    quantity: int = Field(default=1, ge=1, le=9999)
    unit: str = Field(default="items", min_length=1, max_length=30)
    expiry: date | None = None

    @field_validator("name", "unit")
    @classmethod
    def clean_text(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter a name or unit.")
        return value


class FridgeRead(FridgeInput):
    id: int
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[FridgeRead])
def get_fridge(db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    return db.scalars(select(FridgeItem).where(FridgeItem.owner_id == user.id).order_by(FridgeItem.name)).all()


@router.post("", response_model=FridgeRead, status_code=201)
def add_food(payload: FridgeInput, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    item = FridgeItem(owner_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def owned_item(db, item_id, user_id):
    item = db.get(FridgeItem, item_id)
    if not item or item.owner_id != user_id:
        raise HTTPException(404, "Food not found")
    return item


@router.put("/{item_id}", response_model=FridgeRead)
def update_food(item_id: int, payload: FridgeInput, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    item = owned_item(db, item_id, user.id)
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def remove_food(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    db.delete(owned_item(db, item_id, user.id))
    db.commit()
    return Response(status_code=204)


# Match exact ingredient names conservatively; quantities still need checking.
def ingredient_key(name):
    import re
    value = re.sub(r"[^a-z0-9 ]", "", name.casefold()).strip()
    aliases = {"tomatoes": "tomato", "potatoes": "potato", "onions": "onion", "eggs": "egg", "carrots": "carrot"}
    return aliases.get(value, value)


@router.get("/meals/suggestions")
async def meal_suggestions(request: Request, ingredient: str = "", q: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    import asyncio
    from app.catalog import meal_client
    foods = [f for f in get_fridge(db, user) if not f.expiry or f.expiry >= date.today()]
    available = {ingredient_key(f.name) for f in foods}
    client = request.app.state.http
    if q.strip():
        if len(q) > 120:
            raise HTTPException(422, "Recipe search is too long.")
        summaries = await meal_client.search_by_name(client, q.strip())
    elif ingredient:
        if ingredient_key(ingredient) not in available:
            raise HTTPException(422, "Choose an ingredient in your fridge that has not expired.")
        summaries = await meal_client.search_by_ingredient(client, ingredient)
    else:
        if not foods:
            return []
        # A bounded search across selected foods; rank by the whole checklist.
        batches = await asyncio.gather(*(meal_client.search_by_ingredient(client, f.name) for f in foods[:3]))
        summaries = []
        seen = set()
        # Interleave providers' results so the first food cannot fill the limit.
        for row in range(4):
            for batch in batches:
                if row < len(batch) and batch[row]['external_id'] not in seen:
                    summaries.append(batch[row])
                    seen.add(batch[row]['external_id'])
    details = await asyncio.gather(*(meal_client.lookup(client, r['external_id']) for r in summaries[:12]))
    results = []
    for meal in details:
        if meal:
            meal['have'] = [i for i in meal['ingredients'] if ingredient_key(i['name']) in available]
            meal['missing'] = [i for i in meal['ingredients'] if ingredient_key(i['name']) not in available]
            results.append(meal)
    return sorted(results, key=lambda r: (-len(r['have']), len(r['missing'])))


@router.post("/meals/{external_id}/to-list/{list_id}")
async def add_missing(external_id: str, list_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    from app.catalog import meal_client
    from app.models import GroceryList, ListItem
    from app.catalog.auto_categorize import categorize
    from app.routers.recipes import _parse_quantity
    from app.permissions import can_write
    if not db.get(GroceryList, list_id):
        raise HTTPException(404, "List not found")
    if not can_write(db, user.id, list_id):
        raise HTTPException(403, "You do not have edit access to this list")
    meal = await meal_client.lookup(request.app.state.http, external_id)
    if not meal:
        raise HTTPException(404, "Recipe not found")
    have = {ingredient_key(f.name) for f in get_fridge(db, user) if not f.expiry or f.expiry >= date.today()}
    existing = {ingredient_key(i.name) for i in db.scalars(select(ListItem).where(ListItem.list_id == list_id)).all()}
    added = 0
    for ingredient in meal['ingredients']:
        key = ingredient_key(ingredient['name'])
        if key and key not in have and key not in existing:
            category, _, subcategory = categorize(ingredient['name'])
            db.add(ListItem(list_id=list_id, name=ingredient['name'][:100], quantity=_parse_quantity(ingredient.get('measure')), purchased=False, description=ingredient.get('original'), category=category, subcategory=subcategory))
            existing.add(key)
            added += 1
    db.commit()
    return {"added": added}
