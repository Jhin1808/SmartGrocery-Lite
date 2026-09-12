# app/routers/auth_google.py
import os
import logging
from urllib.parse import urlencode, urlparse
import httpx
from fastapi import APIRouter, Request, Depends
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import create_access_token
from app.security_cookies import set_login_cookie, COOKIE_NAME
from app.email_resend import ensure_contact
from app.config import env_flag, get_frontend_url

router = APIRouter(prefix="/auth/google", tags=["auth:google"])
logger = logging.getLogger(__name__)

def _backend_url(request: Request) -> str:
    # Prefer explicit env; otherwise reconstruct from forwarded headers
    env = os.getenv("BACKEND_URL")
    if env:
        return env.rstrip("/")
    scheme = (request.headers.get("x-forwarded-proto") or request.url.scheme).split(",", 1)[0].strip()
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.hostname).split(",", 1)[0].strip()
    return f"{scheme}://{host}".rstrip("/")


def _redirect_uri(request: Request) -> str:
    # Pin the exact URI registered with Google when a custom API host/proxy is used.
    uri = (os.getenv("GOOGLE_REDIRECT_URI") or "").strip() or f"{_backend_url(request)}/auth/google/callback"
    parsed = urlparse(uri)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username or parsed.password or parsed.fragment or parsed.query):
        raise ValueError("Google redirect URI must be an absolute HTTP(S) callback URL")
    return uri


def _login_error(code: str) -> RedirectResponse:
    return RedirectResponse(f"{get_frontend_url()}/login?" + urlencode({"auth_error": code}))

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    client_kwargs={"scope": "openid email profile"},
)

# Optional: include token in fragment for Safari/ITP fallback.
# Disabled by default because URL fragments are readable by frontend JavaScript.
TOKEN_IN_FRAGMENT = env_flag(
    "OAUTH_TOKEN_IN_FRAGMENT",
    default=env_flag("AUTH_HEADER_FALLBACK_ENABLED"),
)
FRAGMENT_TOKEN_PARAM = os.getenv("OAUTH_FRAGMENT_TOKEN_PARAM") or COOKIE_NAME

@router.get("/login")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return _login_error("google_unavailable")
    try:
        return await oauth.google.authorize_redirect(request, _redirect_uri(request))
    except (OAuthError, httpx.HTTPError, ValueError) as exc:
        logger.warning("Google sign-in could not start (%s)", type(exc).__name__)
        return _login_error("google_unavailable")

@router.get("/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if request.query_params.get("error"):
        return _login_error("google_cancelled")

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return _login_error("google_unavailable")

    try:
        token = await oauth.google.authorize_access_token(request)
    except (OAuthError, httpx.HTTPError) as exc:
        logger.warning("Google sign-in callback failed (%s)", type(exc).__name__)
        return _login_error("google_failed")

    userinfo = token.get("userinfo")
    if not userinfo or "email" not in userinfo:
        return _login_error("google_failed")

    email = userinfo["email"]
    sub   = userinfo.get("sub")
    name  = userinfo.get("name")
    pic   = userinfo.get("picture")

    user = db.query(User).filter((User.google_sub == sub) | (User.email == email)).first()
    if not user:
        user = User(email=email, google_sub=sub, name=name, picture=pic)
        db.add(user); db.commit(); db.refresh(user)
        try:
            ensure_contact(user.email, user.name)
        except Exception:
            pass
    else:
        changed = False
        if not user.google_sub and sub:
            user.google_sub = sub; changed = True
        if name and user.name != name:
            user.name = name; changed = True
        if pic and user.picture != pic:
            user.picture = pic; changed = True
        if changed:
            db.commit(); db.refresh(user)

    jwt = create_access_token(user.id)
    url = f"{get_frontend_url()}/oauth/callback"
    if TOKEN_IN_FRAGMENT:
        url = f"{url}#" + urlencode({FRAGMENT_TOKEN_PARAM: jwt})
    resp = RedirectResponse(url)
    set_login_cookie(resp, jwt)
    return resp
