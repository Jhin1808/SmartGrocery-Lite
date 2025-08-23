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
from app.security_cookies import set_login_cookie

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
    # canceled?
    error = request.query_params.get("error")
    if error:
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
    resp = RedirectResponse(f"{_frontend_url()}/oauth/callback")  # clean URL; no token
    set_login_cookie(resp, jwt)
    return resp


# # backend/app/routers/auth_google.py
# # backend/app/routers/auth_google.py
# import os
# from urllib.parse import urlencode

# from fastapi import APIRouter, Request, Depends
# from starlette.responses import RedirectResponse
# from authlib.integrations.starlette_client import OAuth, OAuthError
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.models import User
# from app.security import create_access_token

# from app.security_cookies import set_access_cookie
# from starlette.responses import RedirectResponse

# router = APIRouter(prefix="/auth/google", tags=["auth:google"])

# def _frontend_url() -> str:
#     v = os.getenv("FRONTEND_URL")
#     if not v:
#         raise RuntimeError("FRONTEND_URL must be set")
#     return v.rstrip("/")

# GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
# GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
# if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
#     raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set")

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
#     redirect_uri = request.url_for("google_callback")
#     return await oauth.google.authorize_redirect(request, redirect_uri)

# @router.get("/callback")
# async def google_callback(request: Request, db: Session = Depends(get_db)):
#     # Canceled on Google?
#     if request.query_params.get("error"):
#         return RedirectResponse(f"{_frontend_url()}/login")

#     try:
#         token = await oauth.google.authorize_access_token(request)
#     except OAuthError:
#         return RedirectResponse(f"{_frontend_url()}/login")

#     userinfo = token.get("userinfo") or {}
#     email = userinfo.get("email")
#     if not email:
#         return RedirectResponse(f"{_frontend_url()}/login")

#     user = db.query(User).filter(User.email == email).first()
#     if not user:
#         user = User(email=email, google_sub=userinfo.get("sub"), name=userinfo.get("name"), picture=userinfo.get("picture"))
#         db.add(user); db.commit(); db.refresh(user)

#     jwt = create_access_token(user.id)

#     # Set cookie then bounce to SPA
#     resp = RedirectResponse(f"{_frontend_url()}/lists")
#     set_access_cookie(resp, jwt)
#     return resp
