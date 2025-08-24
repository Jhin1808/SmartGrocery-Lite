# app/routers/auth_google.py
import os
from fastapi import APIRouter, Request, Depends
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import User
from app.security import create_access_token
from app.security_cookies import set_login_cookie

router = APIRouter(prefix="/auth/google", tags=["auth:google"])

# ---- Env & URLs ----
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
FRONTEND_URL = (os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")[0]).rstrip("/")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set")

# Build a stable redirect_uri that matches Google OAuth console
REDIRECT_URI = f"{BACKEND_URL}/auth/google/callback"

# ---- OAuth client ----
oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    client_kwargs={"scope": "openid email profile"},
)

def _bounce_frontend(path: str = "/", error: str | None = None) -> RedirectResponse:
    url = f"{FRONTEND_URL}{path}"
    if error:
        # Keep it short and opaque for the UI; don't leak internals.
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}error={error}"
    return RedirectResponse(url)

# ---- Routes ----
@router.get("/login")
async def google_login(request: Request):
    # Use explicit REDIRECT_URI tied to BACKEND_URL
    # (avoids reverse-proxy/Host header surprises)
    return await oauth.google.authorize_redirect(
        request,
        redirect_uri=REDIRECT_URI,
        # optional: prompt="select_account" to force account chooser each time
        # prompt="select_account",
    )

@router.get("/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    # If user canceled at Google
    if (err := request.query_params.get("error")):
        return _bounce_frontend("/login", error="oauth_canceled")

    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        return _bounce_frontend("/login", error="oauth_exchange_failed")

    # Robustly extract user info:
    userinfo = None
    try:
        # Prefer ID Token when available (OIDC)
        userinfo = await oauth.google.parse_id_token(request, token)
    except Exception:
        # Fallback to userinfo endpoint
        try:
            userinfo = await oauth.google.userinfo(token=token)
        except Exception:
            userinfo = None

    if not userinfo or "email" not in userinfo:
        return _bounce_frontend("/login", error="no_email")

    email = userinfo.get("email")
    sub   = userinfo.get("sub")
    name  = userinfo.get("name")
    pic   = userinfo.get("picture")

    # Find by google_sub or email
    user = db.query(User).filter(
        or_(User.google_sub == sub, User.email == email)
    ).first()

    if not user:
        user = User(email=email, google_sub=sub, name=name, picture=pic)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        changed = False
        if sub and not user.google_sub:
            user.google_sub = sub; changed = True
        if name and user.name != name:
            user.name = name; changed = True
        if pic and user.picture != pic:
            user.picture = pic; changed = True
        if changed:
            db.commit()
            db.refresh(user)

    # Issue our session token (HTTP-only cookie)
    jwt = create_access_token(user.id)
    resp = _bounce_frontend("/oauth/callback")  # Clean URL; SPA can then /me
    set_login_cookie(resp, jwt)
    return resp
