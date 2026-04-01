import os
import logging


def _headers() -> dict:
    rk = os.getenv("RESEND_API_KEY")
    if not rk:
        raise RuntimeError("RESEND_API_KEY not set")
    return {"Authorization": f"Bearer {rk}", "Content-Type": "application/json"}


def ensure_contact(email: str, name: str | None = None) -> bool:
    """Upsert a contact into a Resend Audience if configured.

    Requires RESEND_API_KEY and RESEND_AUDIENCE_ID.
    Returns True if contact exists/was created; False if audience not configured.
    Raises on hard provider errors.
    """
    audience_id = os.getenv("RESEND_AUDIENCE_ID")
    if not audience_id:
        # Not enforcing audiences
        logging.getLogger("app.email").debug("No RESEND_AUDIENCE_ID set; skipping contact upsert for %s", email)
        return False

    # Prefer Vercel function relay if configured
    vercel_upsert = os.getenv("VERCEL_RESEND_UPSERT_URL")
    if vercel_upsert:
        import httpx
        headers = {"x-api-key": (os.getenv("EMAIL_TEST_SECRET") or os.getenv("CRON_SECRET") or "")}
        payload = {"email": email, "name": name}
        r = httpx.post(vercel_upsert, json=payload, headers=headers, timeout=10.0)
        if r.status_code in (200, 201):
            logging.getLogger("app.email").info("Vercel ensured contact: %s", email)
            return True
        if r.status_code == 409:
            logging.getLogger("app.email").info("Vercel contact already exists: %s", email)
            return True
        body = None
        try:
            body = r.json()
        except Exception:
            body = r.text
        logging.getLogger("app.email").error("Vercel upsert failed %s body=%s", r.status_code, body)
        r.raise_for_status()
        return False

    payload = {
        "email": email,
        "audience_id": audience_id,
        # Optional metadata
    }
    if name:
        payload["first_name"] = name

    import httpx

    try:
        r = httpx.post(
            "https://api.resend.com/contacts",
            headers=_headers(),
            json=payload,
            timeout=10.0,
        )
        if r.status_code in (200, 201):
            logging.getLogger("app.email").info("Resend contact ensured: %s", email)
            return True
        # Some Resend APIs return 409 on existing; treat as success
        if r.status_code == 409:
            logging.getLogger("app.email").info("Resend contact already exists: %s", email)
            return True
        # Log body for visibility
        body = None
        try:
            body = r.json()
        except Exception:
            body = r.text
        logging.getLogger("app.email").error("Resend contact upsert failed %s body=%s", r.status_code, body)
        r.raise_for_status()
    except Exception:
        raise
    return False


def sync_all_users(users: list[tuple[int, str, str | None]]) -> dict:
    """Upsert a list of users (id, email, name) to the audience.

    Returns summary counters.
    """
    ok = 0
    fail = 0
    for _id, email, name in users:
        try:
            if ensure_contact(email, name):
                ok += 1
            else:
                # Audience not configured; skip
                pass
        except Exception:
            fail += 1
    return {"ok": ok, "fail": fail}
