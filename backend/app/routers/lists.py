# app/routers/lists.py
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_

from app.database import get_db
from app.models import GroceryList, User, ListItem, ListShare, ShareRole
from app.schemas import (
    ListCreate, ListRead, ListUpdate,
    ItemCreate, ItemRead, ItemUpdate,
    ShareCreate, ShareRead, ShareRoleUpdate,
)
from app.deps import get_current_user_cookie as get_current_user
from app.schemas import ListUpdate

router = APIRouter(prefix="/lists", tags=["lists"])

# ---------- helpers ----------

def _get_list_or_404(db: Session, list_id: int) -> GroceryList:
    gl = db.get(GroceryList, list_id)
    if not gl:
        raise HTTPException(status_code=404, detail="List not found")
    return gl

def _can_read(db: Session, gl: GroceryList, user: User) -> bool:
    if gl.owner_id == user.id:
        return True
    share = db.execute(
        select(ListShare).where(
            (ListShare.list_id == gl.id) & (ListShare.user_id == user.id)
        )
    ).scalar_one_or_none()
    return share is not None  # viewer/editor can read

def _can_edit(db: Session, gl: GroceryList, user: User) -> bool:
    if gl.owner_id == user.id:
        return True
    share = db.execute(
        select(ListShare).where(
            (ListShare.list_id == gl.id) & (ListShare.user_id == user.id)
        )
    ).scalar_one_or_none()
    return share is not None and share.role == ShareRole.editor

def _require_read(db: Session, gl: GroceryList, user: User):
    if not _can_read(db, gl, user):
        raise HTTPException(status_code=404, detail="List not found")

def _require_edit(db: Session, gl: GroceryList, user: User):
    if not _can_edit(db, gl, user):
        raise HTTPException(status_code=404, detail="List not found")


# ---------- Lists ----------

@router.post("/", response_model=ListRead, status_code=201)
def create_list(
    payload: ListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new = GroceryList(name=payload.name, owner_id=current_user.id)
    db.add(new)
    db.commit()
    db.refresh(new)
    return new

@router.get("/", response_model=list[ListRead])
def read_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Owned OR shared with me
    q = (
        select(GroceryList)
        .outerjoin(ListShare, ListShare.list_id == GroceryList.id)
        .where(or_(GroceryList.owner_id == current_user.id, ListShare.user_id == current_user.id))
    )
    # .unique() avoids dupes when multiple shares (shouldn’t happen due to unique constraint)
    lists = db.execute(q).scalars().unique().all()
    return lists

@router.delete("/{list_id}", status_code=204)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = db.get(GroceryList, list_id)
    if not gl or gl.owner_id != current_user.id:
        # Only the owner can delete; keep 404 for privacy
        raise HTTPException(status_code=404, detail="List not found")

    db.delete(gl)
    db.commit()
    return Response(status_code=204)


# ---------- Items ----------

@router.post("/{list_id}/items", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
def add_item(
    list_id: int,
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = _get_list_or_404(db, list_id)
    _require_edit(db, gl, current_user)

    item = ListItem(
        name=payload.name,
        quantity=payload.quantity,
        expiry=payload.expiry,
        list_id=list_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.get("/{list_id}/items", response_model=list[ItemRead])
def get_items(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = _get_list_or_404(db, list_id)
    _require_read(db, gl, current_user)

    return db.execute(
        select(ListItem).where(ListItem.list_id == list_id)
    ).scalars().all()

@router.patch("/items/{item_id}", response_model=ItemRead)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(ListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    gl = _get_list_or_404(db, item.list_id)
    _require_edit(db, gl, current_user)

    if payload.name is not None:
        item.name = payload.name or item.name
    if payload.quantity is not None:
        item.quantity = payload.quantity
    # allow clearing expiry
    if payload.expiry is not None:
        item.expiry = payload.expiry

    db.commit()
    db.refresh(item)
    return item

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.get(ListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    gl = _get_list_or_404(db, item.list_id)
    _require_edit(db, gl, current_user)

    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Sharing (owner-only management) ----------

@router.get("/{list_id}/share", response_model=list[ShareRead])
def list_shares(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = _get_list_or_404(db, list_id)
    if gl.owner_id != current_user.id:
        # We do not reveal shares if you are not the owner
        raise HTTPException(status_code=404, detail="List not found")

    shares = db.execute(
        select(ListShare).where(ListShare.list_id == list_id)
    ).scalars().all()

    # Include recipient email in response
    return [
        ShareRead(
            id=s.id,
            list_id=s.list_id,
            user_id=s.user_id,
            email=s.user.email if s.user else "",
            role=s.role.value if hasattr(s.role, "value") else str(s.role),
        )
        for s in shares
    ]

@router.post("/{list_id}/share", response_model=ShareRead, status_code=201)
def create_or_update_share(
    list_id: int,
    payload: ShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = _get_list_or_404(db, list_id)
    if gl.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="List not found")

    # can't share with yourself
    if payload.email.lower() == current_user.email.lower():
        raise HTTPException(status_code=400, detail="Cannot share a list with yourself")

    # find the target user
    target = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # upsert
    share = db.execute(
        select(ListShare).where(
            (ListShare.list_id == list_id) & (ListShare.user_id == target.id)
        )
    ).scalar_one_or_none()

    if share:
        share.role = ShareRole(payload.role)  # update role
    else:
        share = ListShare(list_id=list_id, user_id=target.id, role=ShareRole(payload.role))
        db.add(share)

    db.commit()
    db.refresh(share)

    return ShareRead(
        id=share.id,
        list_id=share.list_id,
        user_id=share.user_id,
        email=target.email,
        role=share.role.value,
    )

# @router.patch("/{list_id}/share/{share_id}", response_model=ShareRead)
# def update_share_role(
#     list_id: int,
#     share_id: int,
#     payload: ShareCreate,  # reuse for role; ignore email
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     gl = _get_list_or_404(db, list_id)
#     if gl.owner_id != current_user.id:
#         raise HTTPException(status_code=404, detail="List not found")

#     share = db.get(ListShare, share_id)
#     if not share or share.list_id != list_id:
#         raise HTTPException(status_code=404, detail="Share not found")

#     share.role = ShareRole(payload.role)
#     db.commit()
#     db.refresh(share)

#     # include target email
#     target = db.get(User, share.user_id)
#     return ShareRead(
#         id=share.id,
#         list_id=share.list_id,
#         user_id=share.user_id,
#         email=target.email if target else "",
#         role=share.role.value,
#     )

@router.patch("/{list_id}/share/{share_id}", response_model=ShareRead)
def update_share_role(
    list_id: int,
    share_id: int,
    payload: ShareRoleUpdate,  # role-only payload: {"role":"viewer"|"editor"}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = _get_list_or_404(db, list_id)
    if gl.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="List not found")

    share = db.get(ListShare, share_id)
    if not share or share.list_id != list_id:
        raise HTTPException(status_code=404, detail="Share not found")

    share.role = ShareRole(payload.role)
    db.commit()
    db.refresh(share)

    target = db.get(User, share.user_id)
    return ShareRead(
        id=share.id,
        list_id=share.list_id,
        user_id=share.user_id,
        email=target.email if target else "",
        role=share.role.value,
    )


@router.delete("/{list_id}/share/{share_id}", status_code=204)
def revoke_share(
    list_id: int,
    share_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = _get_list_or_404(db, list_id)
    if gl.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="List not found")

    share = db.get(ListShare, share_id)
    if not share or share.list_id != list_id:
        raise HTTPException(status_code=404, detail="Share not found")

    db.delete(share)
    db.commit()
    return Response(status_code=204)

@router.patch("/{list_id}", response_model=ListRead)
def rename_list(
    list_id: int,
    payload: ListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = db.get(GroceryList, list_id)
    if not gl or gl.owner_id != current_user.id:
        # 404 keeps “no info” on lists you don’t own
        raise HTTPException(status_code=404, detail="List not found")
    gl.name = payload.name.strip()
    if not gl.name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    db.commit(); db.refresh(gl)
    return gl

# # app/routers/lists.py
# from fastapi import APIRouter, Depends, HTTPException, Response, status
# from sqlalchemy.orm import Session
# from sqlalchemy import select

# from app.database import get_db
# from app.models import GroceryList, User, ListItem
# from app.schemas import ListCreate, ListRead, ItemCreate, ItemRead


# from app.deps import get_current_user_cookie as get_current_user
# #from app.deps import get_current_user


# router = APIRouter(prefix="/lists", tags=["lists"])

# @router.post("/", response_model=ListRead, status_code=201)
# def create_list(
#     payload: ListCreate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     new = GroceryList(name=payload.name, owner_id=current_user.id)
#     db.add(new); db.commit(); db.refresh(new)
#     return new

# @router.get("/", response_model=list[ListRead])
# def read_lists(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     return db.execute(
#         select(GroceryList).where(GroceryList.owner_id == current_user.id)
#     ).scalars().all()

# @router.post("/{list_id}/items", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
# def add_item(
#     list_id: int,
#     payload: ItemCreate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     gl = db.get(GroceryList, list_id)
#     if not gl or gl.owner_id != current_user.id:
#         raise HTTPException(status_code=404, detail="List not found")
#     item = ListItem(name=payload.name, quantity=payload.quantity, expiry=payload.expiry, list_id=list_id)
#     db.add(item); db.commit(); db.refresh(item)
#     return item

# @router.get("/{list_id}/items", response_model=list[ItemRead])
# def get_items(
#     list_id: int,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     gl = db.get(GroceryList, list_id)
#     if not gl or gl.owner_id != current_user.id:
#         raise HTTPException(status_code=404, detail="List not found")
#     return db.execute(select(ListItem).where(ListItem.list_id == list_id)).scalars().all()

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
#         raise HTTPException(status_code=404, detail="Item not found")

#     db.delete(item); db.commit()
#     return Response(status_code=status.HTTP_204_NO_CONTENT)

# @router.patch("/items/{item_id}", response_model=ItemRead)
# def update_item(
#     item_id: int,
#     payload: ItemCreate,  # you can switch to ItemUpdate schema later
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     item = db.get(ListItem, item_id)
#     if not item:
#         raise HTTPException(status_code=404, detail="Item not found")

#     parent = db.get(GroceryList, item.list_id)
#     if not parent or parent.owner_id != current_user.id:
#         raise HTTPException(status_code=404, detail="Item not found")

#     item.name = payload.name or item.name
#     item.quantity = payload.quantity or item.quantity
#     item.expiry = payload.expiry
#     db.commit(); db.refresh(item)
#     return item


