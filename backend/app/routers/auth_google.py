# app/routers/auth_google.py
import os
from urllib.parse import urlencode
from fastapi import APIRouter, Request, Depends
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import create_access_token
from app.security_cookies import set_login_cookie, COOKIE_NAME
from app.email_resend import ensure_contact

router = APIRouter(prefix="/auth/google", tags=["auth:google"])

def _frontend_url() -> str:
    v = os.getenv("FRONTEND_URL")
    if not v:
        raise RuntimeError("FRONTEND_URL must be set")
    return v.rstrip("/")

def _backend_url(request: Request) -> str:
    # Prefer explicit env; otherwise reconstruct from forwarded headers
    env = os.getenv("BACKEND_URL")
    if env:
        return env.rstrip("/")
    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.hostname
    return f"{scheme}://{host}".rstrip("/")

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set")

oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    client_kwargs={"scope": "openid email profile"},
)

# Optional: include token in fragment for Safari/ITP fallback
TOKEN_IN_FRAGMENT = (os.getenv("OAUTH_TOKEN_IN_FRAGMENT", "1").lower() in ("1", "true", "yes"))
FRAGMENT_TOKEN_PARAM = os.getenv("OAUTH_FRAGMENT_TOKEN_PARAM") or COOKIE_NAME

@router.get("/login")
async def google_login(request: Request):
    redirect_uri = f"{_backend_url(request)}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if request.query_params.get("error"):
        return RedirectResponse(f"{_frontend_url()}/login")

    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse(f"{_frontend_url()}/login")

    userinfo = token.get("userinfo")
    if not userinfo or "email" not in userinfo:
        return RedirectResponse(f"{_frontend_url()}/login")

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
    url = f"{_frontend_url()}/oauth/callback"
    if TOKEN_IN_FRAGMENT:
        url = f"{url}#" + urlencode({FRAGMENT_TOKEN_PARAM: jwt})
    resp = RedirectResponse(url)
    set_login_cookie(resp, jwt)
    return resp

