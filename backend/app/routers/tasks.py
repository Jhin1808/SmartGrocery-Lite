# app/routers/tasks.py
import os
from datetime import datetime, date
from typing import Dict, List

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func

from app.database import get_db
from app.models import ListItem, GroceryList, User

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _send_email(to: str, subject: str, html: str, text: str | None = None) -> None:
    frm = os.getenv("EMAIL_FROM") or "no-reply@example.com"
    rk = os.getenv("RESEND_API_KEY")
    if rk:
        import httpx

        payload = {"from": frm, "to": [to], "subject": subject, "html": html}
        if text:
            payload["text"] = text
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {rk}", "Content-Type": "application/json"},
            json=payload,
            timeout=10.0,
        )
        r.raise_for_status()
        return

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    pwd = os.getenv("SMTP_PASS")
    if host and user and pwd:
        from email.message import EmailMessage
        import smtplib

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = frm
        msg["To"] = to
        if text:
            msg.set_content(text)
        msg.add_alternative(html, subtype="html")
        with smtplib.SMTP(host, port) as s:
            s.starttls()
            s.login(user, pwd)
            s.send_message(msg)
        return
    # No provider configured → noop


@router.post("/run-reminders")
def run_reminders(
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    secret = os.getenv("CRON_SECRET")
    token_ok = False
    if secret:
        if x_api_key and x_api_key == secret:
            token_ok = True
        if authorization and authorization.lower().startswith("bearer ") and authorization.split(" ", 1)[1] == secret:
            token_ok = True
        if not token_ok:
            raise HTTPException(status_code=401, detail="Unauthorized")

    today = date.today()
    # Items to remind: remind_on <= today and (reminded_at is null or reminded_at < remind_on)
    q = (
        db.execute(
            select(ListItem, GroceryList, User)
            .join(GroceryList, ListItem.list_id == GroceryList.id)
            .join(User, GroceryList.owner_id == User.id)
            .where(
                and_(
                    ListItem.remind_on.is_not(None),
                    ListItem.remind_on <= today,
                    ListItem.reminded_at.is_(None),
                )
            )
        )
        .all()
    )

    if not q:
        return {"ok": True, "sent": 0}

    # Group by owner
    grouped: Dict[int, List[ListItem]] = {}
    owners: Dict[int, User] = {}
    lists_map: Dict[int, GroceryList] = {}
    for item, gl, owner in q:
        owners[owner.id] = owner
        lists_map[gl.id] = gl
        grouped.setdefault(owner.id, []).append((item, gl))

    total_sent = 0
    now = datetime.utcnow()
    for owner_id, pairs in grouped.items():
        owner = owners[owner_id]
        # Build digest HTML
        rows = []
        for item, gl in pairs:
            exp = item.expiry.isoformat() if item.expiry else "—"
            rn = item.remind_on.isoformat() if item.remind_on else "—"
            rows.append(f"<tr><td>{gl.name}</td><td>{item.name}</td><td>{exp}</td><td>{rn}</td></tr>")
        html = f"""
        <p>Hi {owner.name or owner.email},</p>
        <p>Here are your item reminders for today:</p>
        <table border=1 cellpadding=6 cellspacing=0>
          <thead><tr><th>List</th><th>Item</th><th>Expiry</th><th>Remind On</th></tr></thead>
          <tbody>{''.join(rows)}</tbody>
        </table>
        <p>You can adjust or clear reminders in the app.</p>
        """
        _send_email(owner.email, "SmartGrocery reminders", html, None)
        total_sent += 1
        # Mark items as reminded
        for item, _ in pairs:
            item.reminded_at = now
        db.commit()

    return {"ok": True, "sent": total_sent}
