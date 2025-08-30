# app/security_cookies.py
import os
from fastapi import Response

COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "access_token")

def _bool_env(name: str, default=False):
    return (os.getenv(name, "1" if default else "0").lower() in ("1", "true", "yes"))

def set_login_cookie(resp: Response, token: str):
    # cross-site cookie
    secure   = _bool_env("COOKIE_SECURE", True)
    samesite = os.getenv("COOKIE_SAMESITE", "none").lower()
    if samesite == "none" and not secure:
        secure = True
    domain   = os.getenv("COOKIE_DOMAIN") or None    # usually omit for Koyeb
    resp.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure,
        samesite=samesite,   # 'none'
        domain=domain,       # leave None unless you know you need it
        path="/",
        max_age=60 * 60 * 24 * 30,  # 30 days
    )

def clear_login_cookie(resp: Response):
    domain   = os.getenv("COOKIE_DOMAIN") or None
    samesite = os.getenv("COOKIE_SAMESITE", "none").lower()
    secure   = _bool_env("COOKIE_SECURE", True)
    if samesite == "none" and not secure:
        secure = True
    resp.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        domain=domain,
        samesite=samesite,
        secure=secure,
    )

