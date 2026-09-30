from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr, Field
import os
import secrets

from sqlalchemy.orm import Session
from app.routers.auth import _send_reset_code_email
from app.email_resend import sync_all_users
from app.database import get_db
from app.models import User

__test__ = False


def require_email_admin(request: Request):
    secret = (os.getenv("EMAIL_ADMIN_SECRET") or "").strip()
    provided = request.headers.get("x-api-key") or ""
    if (len(secret) < 32 or not secrets.compare_digest(
            provided.encode("utf-8"), secret.encode("utf-8"))):
        raise HTTPException(status_code=401, detail="Unauthorized")


router = APIRouter(prefix="/auth", include_in_schema=False,
                   dependencies=[Depends(require_email_admin)])


class EmailTest(BaseModel):
    to: EmailStr
    minutes: int = Field(default=5, ge=1, le=60)
    code_length: int = Field(default=6, ge=6, le=12)


@router.post("/_test-email")
def test_email_sender(payload: EmailTest):
    code = "".join(secrets.choice("0123456789") for _ in range(payload.code_length))
    try:
        _send_reset_code_email(payload.to, code, minutes=payload.minutes)
    except Exception:
        raise HTTPException(status_code=502, detail="Email operation failed") from None
    return {"ok": True}


@router.post("/_sync-resend-contacts")
def sync_resend_contacts(db: Session = Depends(get_db)):
    users = db.query(User).all()
    data = [(u.id, u.email, getattr(u, "name", None)) for u in users]
    summary = sync_all_users(data)
    return {"ok": True, **summary}
