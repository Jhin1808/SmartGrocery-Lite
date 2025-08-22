# backend/app/routers/lists.py
from typing import Optional
import os

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import GroceryList, User, ListItem
from app.schemas import ListCreate, ListRead, ItemCreate, ItemRead


from app.deps import get_current_user
from app.models import User


router = APIRouter(prefix="/lists", tags=["lists"])

#create list
@router.post("/", response_model=ListRead, status_code=201)
def create_list(payload: ListCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new = GroceryList(name=payload.name, owner_id=current_user.id)
    db.add(new); db.commit(); db.refresh(new)
    return new


# @router.post("/", response_model=ListRead)
# def create_list(payload: ListCreate, db: Session = Depends(get_db)):
#     name = payload.name
#     owner_id = payload.owner_id

#     if owner_id is None:
#         default_email = os.getenv("DEFAULT_USER_EMAIL", "demo@example.com")
#         owner = db.execute(select(User).where(User.email == default_email)).scalar_one_or_none()
#         if owner is None:
#             owner = User(email=default_email)
#             db.add(owner); db.commit(); db.refresh(owner)
#         owner_id = owner.id
#     else:
#         owner = db.get(User, owner_id)
#         if owner is None:
#             raise HTTPException(status_code=400, detail="Owner not found")

#     new = GroceryList(name=name, owner_id=owner_id)
#     db.add(new); db.commit(); db.refresh(new)
#     return new


@router.get("/", response_model=list[ListRead])
def read_lists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.execute(select(GroceryList).where(GroceryList.owner_id == current_user.id)).scalars().all()

# @router.get("/", response_model=list[ListRead])
# def read_lists(db: Session = Depends(get_db)):
#     return db.execute(select(GroceryList)).scalars().all()


# Add an item to a list you own
@router.post("/{list_id}/items", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
def add_item(
    list_id: int,
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = db.get(GroceryList, list_id)
    # Hide existence of others' lists: return 404 if not found or not owned
    if not gl or gl.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="List not found")

    item = ListItem(
        name=payload.name,
        quantity=payload.quantity,
        expiry=payload.expiry,
        list_id=list_id,
    )
    db.add(item); db.commit(); db.refresh(item)
    return item
# @router.post("/{list_id}/items", response_model=ItemRead)
# def add_item(list_id: int, payload: ItemCreate, db: Session = Depends(get_db)):
#     gl = db.get(GroceryList, list_id)
#     if not gl:
#         raise HTTPException(status_code=404, detail="List not found")
#     item = ListItem(
#         name=payload.name,
#         quantity=payload.quantity,
#         expiry=payload.expiry,
#         list_id=list_id
#     )
#     db.add(item); db.commit(); db.refresh(item)
#     return item


# Get items for a list you own
@router.get("/{list_id}/items", response_model=list[ItemRead])
def get_items(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = db.get(GroceryList, list_id)
    if not gl or gl.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="List not found")

    return db.execute(
        select(ListItem).where(ListItem.list_id == list_id)
    ).scalars().all()

# @router.get("/{list_id}/items", response_model=list[ItemRead])
# def get_items(list_id: int, db: Session = Depends(get_db)):
#     gl = db.get(GroceryList, list_id)
#     if not gl:
#         raise HTTPException(status_code=404, detail="List not found")
#     return db.execute(select(ListItem).where(ListItem.list_id == list_id)).scalars().all()


# # Delete an item only if it belongs to one of your lists
# @router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
# def delete_item(
#     item_id: int,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     item = db.get(ListItem, item_id)
#     if not item:
#         raise HTTPException(status_code=404, detail="Item not found")

#     parent = db.get(GroceryList, item.list_id)
#     if not parent or parent.owner_id != current_user.id:
#         # Don’t leak existence
#         raise HTTPException(status_code=404, detail="Item not found")

#     db.delete(item); db.commit()
#     return Response(status_code=status.HTTP_204_NO_CONTENT)

# @router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
# def delete_item(item_id: int, db: Session = Depends(get_db)):
#     item = db.get(ListItem, item_id)
#     if not item:
#         raise HTTPException(status_code=404, detail="Item not found")
#     db.delete(item)
#     db.commit()
#     # IMPORTANT: return an empty response (no JSON body)
#     return Response(status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(ListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    parent = db.get(GroceryList, item.list_id)
    if not parent or parent.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# @router.patch("/items/{item_id}", response_model=ItemRead)
# def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
#     item = db.get(ListItem, item_id)
#     if not item:
#         raise HTTPException(status_code=404, detail="Item not found")
#     if payload.name is not None:
#         item.name = payload.name
#     if payload.quantity is not None:
#         item.quantity = payload.quantity
#     if payload.expiry is not None or payload.expiry is None:
#         # allow clearing expiry by sending null
#         item.expiry = payload.expiry
#     db.commit()
#     db.refresh(item)
#     return item
# Update an item only if it belongs to one of your lists
@router.patch("/items/{item_id}", response_model=ItemRead)
def update_item(
    item_id: int,
    payload: ItemCreate,  # consider an ItemUpdate schema for partial fields
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(ListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    parent = db.get(GroceryList, item.list_id)
    if not parent or parent.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")

    # Simple update (you can switch to an ItemUpdate schema for partial updates)
    item.name = payload.name or item.name
    item.quantity = payload.quantity or item.quantity
    item.expiry = payload.expiry
    db.commit(); db.refresh(item)
    return item
# @router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
# def delete_item(item_id: int, db: Session = Depends(get_db)):
#     item = db.get(ListItem, item_id)
#     if not item:
#         raise HTTPException(status_code=404, detail="Item not found")
#     db.delete(item); db.commit()
#     return Response(status_code=status.HTTP_204_NO_CONTENT)

# (Optional) update item quantity or name
# @router.patch("/items/{item_id}", response_model=ItemRead)
# def update_item(item_id: int, payload: ItemCreate, db: Session = Depends(get_db)):
#     item = db.get(ListItem, item_id)
#     if not item:
#         raise HTTPException(status_code=404, detail="Item not found")
#     item.name = payload.name or item.name
#     item.quantity = payload.quantity or item.quantity
#     item.expiry = payload.expiry
#     db.commit(); db.refresh(item)
#     return item
