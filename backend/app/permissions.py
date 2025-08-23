# app/permissions.py
from sqlalchemy import select
from app.models import GroceryList, ListShare, ShareRole

def can_read(db, user_id: int, list_id: int) -> bool:
    # owner
    if db.get(GroceryList, list_id)?.owner_id == user_id:
        return True
    # shared
    q = select(ListShare).where(ListShare.list_id == list_id, ListShare.user_id == user_id)
    return db.execute(q).scalar_one_or_none() is not None

def can_write(db, user_id: int, list_id: int) -> bool:
    # owner
    gl = db.get(GroceryList, list_id)
    if gl and gl.owner_id == user_id:
        return True
    # shared as editor
    q = select(ListShare).where(
        ListShare.list_id == list_id,
        ListShare.user_id == user_id,
        ListShare.role == ShareRole.editor,
    )
    return db.execute(q).scalar_one_or_none() is not None
