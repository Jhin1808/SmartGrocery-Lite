# backend/app/security_cookies.py
import os
from dataclasses import dataclass
from fastapi import Response

# You can drive these via env to match dev/prod
# .env (examples):
#   COOKIE_NAME=access_token
#   COOKIE_SECURE=false
#   COOKIE_SAMESITE=lax   # lax | strict | none
#   COOKIE_DOMAIN=        # leave empty for localhost
#   COOKIE_PATH=/
#   COOKIE_MAX_AGE=2592000  # 30 days, seconds

def _env_bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes")

@dataclass(frozen=True)
class CookieSettings:
    name: str = os.getenv("COOKIE_NAME", "access_token")
    secure: bool = _env_bool("COOKIE_SECURE", "false")
    samesite: str = os.getenv("COOKIE_SAMESITE", "lax").lower()  # lax|strict|none
    domain: str | None = os.getenv("COOKIE_DOMAIN") or None
    path: str = os.getenv("COOKIE_PATH", "/")
    max_age: int = int(os.getenv("COOKIE_MAX_AGE", "2592000"))  # 30 days

cookie_settings = CookieSettings()

def set_access_cookie(resp: Response, token: str) -> None:
    # Starlette accepts samesite in lower-case ("lax", "strict", "none")
    resp.set_cookie(
        key=cookie_settings.name,
        value=token,
        max_age=cookie_settings.max_age,
        httponly=True,
        secure=cookie_settings.secure,
        samesite=cookie_settings.samesite,
        domain=cookie_settings.domain,
        path=cookie_settings.path,
    )

def clear_access_cookie(resp: Response) -> None:
    resp.delete_cookie(
        key=cookie_settings.name,
        domain=cookie_settings.domain,
        path=cookie_settings.path,
    )
