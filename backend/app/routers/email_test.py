from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
import os
import secrets

from sqlalchemy.orm import Session
from app.routers.auth import _send_reset_code_email
from app.email_resend import ensure_contact, sync_all_users
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class EmailTest(BaseModel):
    to: EmailStr
    minutes: int = 5
    code_length: int = 6


@router.post("/_test-email")
def test_email_sender(payload: EmailTest, request: Request):
    secret = (os.getenv("EMAIL_TEST_SECRET") or os.getenv("CRON_SECRET") or "").strip()
    provided = request.headers.get("x-api-key") or ""
    if not secret or provided != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    code = "".join(secrets.choice("0123456789") for _ in range(max(4, payload.code_length)))
    details = _send_reset_code_email(payload.to, code, minutes=max(1, payload.minutes))
    return {"ok": True, "to": payload.to, "details": details, "code": code}


@router.post("/_sync-resend-contacts")
def sync_resend_contacts(request: Request, db: Session = Depends(get_db)):
    secret = (os.getenv("EMAIL_TEST_SECRET") or os.getenv("CRON_SECRET") or "").strip()
    provided = request.headers.get("x-api-key") or ""
    if not secret or provided != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    users = db.query(User).all()
    data = [(u.id, u.email, getattr(u, "name", None)) for u in users]
    summary = sync_all_users(data)
    return {"ok": True, **summary}
