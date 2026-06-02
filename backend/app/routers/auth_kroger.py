# backend/app/routers/auth_kroger.py
"""Status endpoint for Kroger integration.

In v1 we use app-level client-credentials (no per-user Kroger login),
so this router is intentionally minimal. It exists so the frontend can
show a clear "not configured" vs "configured but no store connected"
state.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import kroger_configured
from app.deps import get_current_user_any as get_current_user
from app.models import ConnectedStore, User
from app.schemas import ConnectedStoreRead, KrogerStatusRead
from app.routers.stores import _to_connected_read

router = APIRouter(prefix="/auth/kroger", tags=["kroger"])


@router.get("/status", response_model=KrogerStatusRead)
def status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.execute(
        select(ConnectedStore).where(ConnectedStore.user_id == current_user.id)
        .order_by(ConnectedStore.connected_at.desc())
    ).scalars().first()
    return KrogerStatusRead(
        configured=kroger_configured(),
        connected_store=_to_connected_read(row) if row else None,
    )
