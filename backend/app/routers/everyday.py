from datetime import date, timedelta
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, or_, exists
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user_any
from app.models import User, GroceryList, ListItem, ListShare, Staple, PurchaseHistory, RestockRun, DemoImport
from app.permissions import can_write
from app.everyday import name_key, record_purchase

router = APIRouter(prefix="/everyday", tags=["everyday"])


class GroceryInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    quantity: int = Field(default=1, ge=1, le=9999)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Enter a grocery name")
        return value


class AddInput(GroceryInput):
    list_id: int = Field(ge=1)


class RestockInput(BaseModel):
    list_id: int = Field(ge=1)


class DemoItem(GroceryInput):
    purchased: bool = False


class ImportInput(BaseModel):
    import_key: UUID
    name: str = Field(min_length=1, max_length=100)
    items: list[DemoItem] = Field(max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return GroceryInput.strip_name(value)


def editable_list(db, user, list_id):
    # Serialize shortcut additions and restocks on the destination in PostgreSQL.
    target = db.execute(select(GroceryList).where(GroceryList.id == list_id).with_for_update()).scalar_one_or_none()
    if not target or not can_write(db, user.id, list_id):
        raise HTTPException(404, "Editable list not found")
    return target


def add_once(db, list_id, name, quantity):
    matches = [item for item in db.scalars(select(ListItem).where(ListItem.list_id == list_id))
               if name_key(item.name) == name_key(name)]
    if any(not item.purchased for item in matches):
        return {"result": "already_present", "item_id": None}
    if matches:
        item = matches[0]
        item.purchased = False
        item.quantity = quantity
        # A new shopping trip must not inherit an old purchase's expiry/reminder.
        item.expiry = item.remind_on = item.reminded_at = None
        return {"result": "restored", "item_id": item.id}
    item = ListItem(list_id=list_id, name=name, quantity=quantity, purchased=False)
    db.add(item)
    db.flush()
    return {"result": "added", "item_id": item.id}


@router.get("")
def overview(on: Optional[date] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    today = on or date.today()
    week = today - timedelta(days=today.weekday())
    staples = db.scalars(select(Staple).where(Staple.user_id == user.id).order_by(Staple.name)).all()
    recent = db.scalars(select(PurchaseHistory).where(PurchaseHistory.user_id == user.id)
                        .order_by(PurchaseHistory.last_purchased_at.desc(), PurchaseHistory.id.desc()).limit(30)).all()
    accessible = or_(GroceryList.owner_id == user.id, exists().where(
        ListShare.list_id == GroceryList.id, ListShare.user_id == user.id, ListShare.hidden.is_(False)))
    expiring = db.execute(select(ListItem, GroceryList.name).join(GroceryList)
        .where(accessible, ListItem.purchased.is_(True), ListItem.expiry.is_not(None),
               ListItem.expiry <= today + timedelta(days=3)).order_by(ListItem.expiry, ListItem.id).limit(100)).all()
    runs = db.scalars(select(RestockRun.list_id).where(RestockRun.user_id == user.id, RestockRun.week_start == week)).all()
    def grocery(row):
        return {"id": row.id, "name": row.name, "quantity": row.quantity}
    return {"staples": [grocery(row) for row in staples],
            "recent": [{**grocery(row), "last_purchased_at": row.last_purchased_at} for row in recent],
            "use_first": [{"id": row.id, "name": row.name, "expiry": row.expiry,
                           "days_left": (row.expiry - today).days, "list_name": list_name, "list_id": row.list_id}
                          for row, list_name in expiring],
            "restocked_list_ids": list(runs)}


@router.post("/staples", status_code=201)
def pin(payload: GroceryInput, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    key = name_key(payload.name)
    row = db.scalar(select(Staple).where(Staple.user_id == user.id, Staple.name_key == key))
    if not row:
        row = Staple(user_id=user.id, name=payload.name, name_key=key, quantity=payload.quantity)
        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            row = db.scalar(select(Staple).where(Staple.user_id == user.id, Staple.name_key == key))
            if row is None:
                raise
    row.quantity = payload.quantity
    db.commit()
    return {"id": row.id, "name": row.name, "quantity": row.quantity}


@router.delete("/staples/{staple_id}", status_code=204)
def unpin(staple_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    row = db.scalar(select(Staple).where(Staple.id == staple_id, Staple.user_id == user.id))
    if not row:
        raise HTTPException(404, "Staple not found")
    db.delete(row)
    db.commit()


@router.post("/add")
def add(payload: AddInput, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    editable_list(db, user, payload.list_id)
    result = add_once(db, payload.list_id, payload.name, payload.quantity)
    db.commit()
    return {**result, "list_id": payload.list_id}


@router.post("/restock")
def restock(payload: RestockInput, on: Optional[date] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    editable_list(db, user, payload.list_id)
    staples = db.scalars(select(Staple).where(Staple.user_id == user.id)).all()
    if not staples:
        raise HTTPException(400, "Pin your staples before restocking")
    counts = {"added": 0, "restored": 0, "already_present": 0}
    restored_ids = []
    for staple in staples:
        outcome = add_once(db, payload.list_id, staple.name, staple.quantity)
        counts[outcome["result"]] += 1
        if outcome["result"] == "restored":
            restored_ids.append(outcome["item_id"])
    today = on or date.today()
    week = today - timedelta(days=today.weekday())
    run = db.scalar(select(RestockRun).where(RestockRun.user_id == user.id, RestockRun.list_id == payload.list_id, RestockRun.week_start == week))
    if not run:
        db.add(RestockRun(user_id=user.id, list_id=payload.list_id, week_start=week))
    db.commit()
    return {**counts, "restored_item_ids": restored_ids}


@router.post("/import-demo", status_code=201)
def import_demo(payload: ImportInput, db: Session = Depends(get_db), user: User = Depends(get_current_user_any)):
    key = str(payload.import_key)
    previous = db.scalar(select(DemoImport).where(DemoImport.user_id == user.id, DemoImport.import_key == key))
    if previous:
        if previous.list_id is None:
            raise HTTPException(410, "The imported list was deleted")
        return {"list_id": previous.list_id, "name": payload.name, "already_imported": True}
    target = GroceryList(owner_id=user.id, name=payload.name)
    db.add(target)
    db.flush()
    target_id = target.id
    for item in payload.items:
        row = ListItem(list_id=target_id, name=item.name, quantity=item.quantity, purchased=item.purchased)
        db.add(row)
        if row.purchased:
            record_purchase(db, user.id, row)
    db.add(DemoImport(user_id=user.id, import_key=key, list_id=target_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        previous = db.scalar(select(DemoImport).where(DemoImport.user_id == user.id, DemoImport.import_key == key))
        if not previous or previous.list_id is None:
            raise
        return {"list_id": previous.list_id, "name": payload.name, "already_imported": True}
    return {"list_id": target_id, "name": payload.name, "already_imported": False}
