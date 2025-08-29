# app/routers/lists.py
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_

from app.database import get_db
from app.models import GroceryList, User, ListItem, ListShare, ShareRole
from app.schemas import (
    ListCreate, ListRead, ListUpdate,
    ItemCreate, ItemRead, ItemUpdate,
    ShareCreate, ShareRead, ShareRoleUpdate,
    ListReadEx,
)
from app.deps import get_current_user_any as get_current_user

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
    return share is not None

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

@router.get("/", response_model=list[ListReadEx])
def read_lists(
    include_hidden: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Owned lists
    owned = db.execute(
        select(GroceryList).where(GroceryList.owner_id == current_user.id)
    ).scalars().all()

    # Shared-to-me lists (optionally filter hidden)
    shared_rows = db.execute(
        select(GroceryList, ListShare)
        .join(ListShare, ListShare.list_id == GroceryList.id)
        .where(
            and_(
                ListShare.user_id == current_user.id,
                True if include_hidden else (ListShare.hidden == False),
            )
        )
    ).all()

    out: list[ListReadEx] = []

    for gl in owned:
        out.append(ListReadEx(
            id=gl.id,
            name=gl.name,
            owner_id=gl.owner_id,
            created_at=getattr(gl, "created_at", None),
            shared=False,
            role="owner",
            hidden=False,
        ))

    for gl, sh in shared_rows:
        out.append(ListReadEx(
            id=gl.id,
            name=gl.name,
            owner_id=gl.owner_id,
            created_at=getattr(gl, "created_at", None),
            shared=True,
            role=("editor" if sh.role == ShareRole.editor else "viewer"),
            hidden=bool(sh.hidden),
        ))

    # De-dup by id (owned wins)
    uniq = {}
    for r in out:
        if r.shared and r.id in uniq:
            # keep existing (owner) over shared
            continue
        uniq[r.id] = r

    # Sort newest first by created_at if available
    ordered = list(uniq.values())
    ordered.sort(key=lambda r: (r.created_at or 0), reverse=True)
    return ordered

@router.post("/{list_id}/hide", status_code=204)
def hide_list_for_me(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = _get_list_or_404(db, list_id)
    if gl.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owners cannot hide their own list")

    share = db.execute(
        select(ListShare).where(
            (ListShare.list_id == list_id) & (ListShare.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="List not found")
    share.hidden = True
    db.commit()
    return Response(status_code=204)

@router.delete("/{list_id}/hide", status_code=204)
def unhide_list_for_me(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    share = db.execute(
        select(ListShare).where(
            (ListShare.list_id == list_id) & (ListShare.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="List not found")
    share.hidden = False
    db.commit()
    return Response(status_code=204)

@router.delete("/{list_id}", status_code=204)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gl = db.get(GroceryList, list_id)
    if not gl or gl.owner_id != current_user.id:
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
        raise HTTPException(status_code=404, detail="List not found")

    shares = db.execute(
        select(ListShare).where(ListShare.list_id == list_id)
    ).scalars().all()

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

    if payload.email.lower() == current_user.email.lower():
        raise HTTPException(status_code=400, detail="Cannot share a list with yourself")

    target = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    share = db.execute(
        select(ListShare).where(
            (ListShare.list_id == list_id) & (ListShare.user_id == target.id)
        )
    ).scalar_one_or_none()

    if share:
        share.role = ShareRole(payload.role)
    else:
        share = ListShare(
            list_id=list_id,
            user_id=target.id,
            role=ShareRole(payload.role),
            hidden=False,
        )
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

@router.patch("/{list_id}/share/{share_id}", response_model=ShareRead)
def update_share_role(
    list_id: int,
    share_id: int,
    payload: ShareRoleUpdate,
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
        raise HTTPException(status_code=404, detail="List not found")
    gl.name = payload.name.strip()
    if not gl.name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    db.commit()
    db.refresh(gl)
    return gl
