# backend/app/routers/auth_google.py
# backend/app/routers/auth_google.py
import os
from urllib.parse import urlencode

from fastapi import APIRouter, Request, Depends
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import create_access_token

from app.security_cookies import set_access_cookie
from starlette.responses import RedirectResponse

router = APIRouter(prefix="/auth/google", tags=["auth:google"])

def _frontend_url() -> str:
    v = os.getenv("FRONTEND_URL")
    if not v:
        raise RuntimeError("FRONTEND_URL must be set")
    return v.rstrip("/")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
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

@router.get("/login")
async def google_login(request: Request):
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    # User canceled → bounce back to login (silent or with flags)
    error = request.query_params.get("error")
    if error:
        # Keep it silent; if you want a toast, add ?error=access_denied and read it on /login
        return RedirectResponse(f"{_frontend_url()}/login")

    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as oe:
        qs = urlencode({"error": "oauth_error", "reason": str(oe)})
        return RedirectResponse(f"{_frontend_url()}/login?{qs}")

    userinfo = token.get("userinfo") or {}
    email = userinfo.get("email")
    sub = userinfo.get("sub")
    if not email or not sub:
        qs = urlencode({"error": "profile_missing", "reason": "No email or sub"})
        return RedirectResponse(f"{_frontend_url()}/login?{qs}")

    # Upsert by google_sub OR email, and make sure we store google_sub
    user = (
        db.query(User)
        .filter((User.google_sub == sub) | (User.email == email))
        .first()
    )
    if user is None:
        user = User(
            email=email,
            google_sub=sub,      # << store it
            name=userinfo.get("name"),
            picture=userinfo.get("picture"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        changed = False
        if not user.google_sub:
            user.google_sub = sub; changed = True
        # keep some profile fields in sync
        new_name = userinfo.get("name")
        new_pic = userinfo.get("picture")
        if new_name and new_name != user.name:
            user.name = new_name; changed = True
        if new_pic and new_pic != user.picture:
            user.picture = new_pic; changed = True
        if changed:
            db.commit()
            db.refresh(user)

    #jwt = create_access_token(user.id)
    jwt = create_access_token({"sub": str(user.id)})
    resp = RedirectResponse(f"{_frontend_url()}/oauth/callback")  # or straight to /lists
    set_access_cookie(resp, jwt)
    return resp
    #return RedirectResponse(f"{_frontend_url()}/oauth/callback?token={jwt}")

# import os
# from urllib.parse import urlencode

# from fastapi import APIRouter, Request, Depends
# from starlette.responses import RedirectResponse
# from authlib.integrations.starlette_client import OAuth, OAuthError
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.models import User
# from app.security import create_access_token

# router = APIRouter(prefix="/auth/google", tags=["auth:google"])


# # --- helpers ---
# def _frontend_url() -> str:
#     """Read FRONTEND_URL from env; fail fast if missing. Trailing slash stripped."""
#     v = os.getenv("FRONTEND_URL")
#     if not v:
#         raise RuntimeError("FRONTEND_URL must be set in the environment")
#     return v.rstrip("/")


# # --- Authlib OAuth client (fail fast if client creds missing) ---
# GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
# GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
# if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
#     raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in the environment")

# oauth = OAuth()
# oauth.register(
#     name="google",
#     server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
#     client_id=GOOGLE_CLIENT_ID,
#     client_secret=GOOGLE_CLIENT_SECRET,
#     client_kwargs={"scope": "openid email profile"},
# )


# @router.get("/login")
# async def google_login(request: Request):
#     # where Google should send the user back to
#     redirect_uri = request.url_for("google_callback")
#     # Authlib builds the authorize URL, adds state, etc.
#     return await oauth.google.authorize_redirect(request, redirect_uri)


# @router.get("/callback")
# async def google_callback(request: Request, db: Session = Depends(get_db)):
#     # 1) User canceled at Google → ?error=access_denied
#     error = request.query_params.get("error")
#     if error:  # e.g. access_denied
#         # simple flag → frontend shows a toast and cleans the URL
#         return RedirectResponse(f"{_frontend_url()}/login")
    
#     # 2) Normal flow: exchange code for tokens
#     try:
#         token = await oauth.google.authorize_access_token(request)
#     except OAuthError as oe:
#         qs = urlencode({"error": "oauth_error", "reason": str(oe)})
#         return RedirectResponse(f"{_frontend_url()}/login?{qs}")

#     # With OIDC, Authlib exposes 'userinfo' (email, sub, etc.)
#     userinfo = token.get("userinfo")
#     if not userinfo or "email" not in userinfo:
#         qs = urlencode({"error": "profile_missing", "reason": "No email from Google"})
#         return RedirectResponse(f"{_frontend_url()}/login?{qs}")

#     email = userinfo["email"]

#     # Minimal upsert by email (keeps your schema simple for now)
#     user = db.query(User).filter(User.email == email).first()
#     if user is None:
#         user = User(email=email)
#         db.add(user)
#         db.commit()
#         db.refresh(user)

#     # Issue your own JWT (same as password login)
#     jwt = create_access_token({"sub": str(user.id)})

#     # Success → send token to SPA
#     return RedirectResponse(f"{_frontend_url()}/oauth/callback?token={jwt}")


# # backend/app/routers/auth_google.py
# import os
# from fastapi import APIRouter, Request, Depends, HTTPException
# from starlette.responses import RedirectResponse
# from authlib.integrations.starlette_client import OAuth
# from authlib.integrations.base_client.errors import OAuthError 
# from sqlalchemy.orm import Session
# from app.database import get_db
# from app.models import User
# from app.security import create_access_token
# from urllib.parse import urlencode


# router = APIRouter(prefix="/auth/google", tags=["auth:google"])

# FRONTEND_URL = os.environ.get("FRONTEND_URL")

# # ---- Authlib OAuth client ----
# oauth = OAuth()
# oauth.register(
#     name="google",
#     server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
#     client_id=os.getenv("GOOGLE_CLIENT_ID"),
#     client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
#     client_kwargs={"scope": "openid email profile"},
# )


# @router.get("/login")
# async def google_login(request: Request):
#     # where Google should send the user back to
#     redirect_uri = request.url_for("google_callback")
#     # Authlib builds the authorize URL, adds state, etc.
#     return await oauth.google.authorize_redirect(request, redirect_uri)


# @router.get("/callback")
# async def google_callback(request: Request, db: Session = Depends(get_db)):
#     # 1) If user canceled on Google, we’ll get ?error=access_denied
#     error = request.query_params.get("error")
#     if error:  # e.g. access_denied
#         qs = urlencode({"error": error, "reason": request.query_params.get("error_description", "Canceled")})
#         return RedirectResponse(f"{_frontend_url()}/login")


#     # 2) Normal flow: exchange code for tokens
#     try:
#         token = await oauth.google.authorize_access_token(request)
#     except OAuthError as oe:
#         qs = urlencode({"error": "oauth_error", "reason": str(oe)})
#         return RedirectResponse(f"{_frontend_url()}/login?{qs}")

#     userinfo = token.get("userinfo")
#     if not userinfo or "email" not in userinfo:
#         qs = urlencode({"error": "profile_missing", "reason": "No email from Google"})
#         return RedirectResponse(f"{_frontend_url()}/login?{qs}")

#     email = userinfo["email"]

#     # Minimal upsert by email (keeps your current schema simple)
#     user = db.query(User).filter(User.email == email).first()
#     if user is None:
#         user = User(email=email)
#         db.add(user); db.commit(); db.refresh(user)

#     jwt = create_access_token({"sub": str(user.id)})

#     # Success → send token to SPA
#     return RedirectResponse(f"{_frontend_url()}/oauth/callback?token={jwt}")
