# app/routers/auth.py
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import RegisterRequest, UserRead
from app.security import hash_password, verify_password, create_access_token
from app.security_cookies import set_login_cookie, clear_login_cookie
from app.deps import get_current_user_cookie as get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(u); db.commit(); db.refresh(u)
    return UserRead(id=u.id, email=u.email)

@router.post("/token", status_code=204)
def token(form: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    # OAuth2 spec calls it "username" — we use email as username
    u = db.query(User).filter(User.email == form.username).first()
    if not u or not u.password_hash or not verify_password(form.password, u.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect email or password")

    jwt = create_access_token(u.id)
    resp = Response(status_code=204)            # no body, just set cookie
    set_login_cookie(resp, jwt)                 # HttpOnly cookie
    return resp

@router.post("/logout", status_code=204)
def logout():
    resp = Response(status_code=204)
    clear_login_cookie(resp)
    return resp

class ChangePassword(BaseModel):
    current_password: str | None = None
    new_password: str

@router.post("/change-password", status_code=204)
def change_password(payload: ChangePassword,
                    db: Session = Depends(get_db),
                    current: User = Depends(get_current_user)):
    # If user already has a password, require current_password
    if current.password_hash:
        if not payload.current_password or not verify_password(payload.current_password, current.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Current password is incorrect")
    # Set/replace new password
    current.password_hash = hash_password(payload.new_password)
    db.commit()
    return


# # app/routers/auth.py
# from fastapi import APIRouter, Depends, HTTPException, status, Response
# from fastapi.security import OAuth2PasswordRequestForm
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.models import User
# from app.security import hash_password, verify_password, create_access_token
# from app.schemas import RegisterRequest, UserRead
# from app.security_cookies import set_access_cookie, clear_access_cookie

# router = APIRouter(prefix="/auth", tags=["auth"])

# @router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
# def register(payload: RegisterRequest, db: Session = Depends(get_db)):
#     if db.query(User).filter(User.email == payload.email).first():
#         raise HTTPException(status_code=400, detail="Email already registered")
#     u = User(email=payload.email, password_hash=hash_password(payload.password))
#     db.add(u); db.commit(); db.refresh(u)
#     return UserRead(id=u.id, email=u.email)

# @router.post("/token", status_code=204)
# def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
#     u = db.query(User).filter(User.email == form.username).first()
#     if not u or not verify_password(form.password, u.password_hash or ""):
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
#     jwt = create_access_token(u.id)
#     resp = Response(status_code=204)
#     set_access_cookie(resp, jwt)
#     return resp

# @router.post("/logout", status_code=204)
# def logout():
#     resp = Response(status_code=204)
#     clear_access_cookie(resp)
#     return resp


# # app/routers/auth.py
# from fastapi import APIRouter, Depends, HTTPException, status, Response
# from fastapi.security import OAuth2PasswordRequestForm
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.models import User
# from app.security import hash_password, verify_password, create_access_token
# from app.schemas import RegisterRequest, UserRead, TokenResponse
# from fastapi import Response
# from app.security_cookies import cookie_settings, set_access_cookie, clear_access_cookie


# router = APIRouter(prefix="/auth", tags=["auth"])

# @router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
# def register(payload: RegisterRequest, db: Session = Depends(get_db)):
#     if db.query(User).filter(User.email == payload.email).first():
#         raise HTTPException(status_code=400, detail="Email already registered")
#     u = User(email=payload.email, password_hash=hash_password(payload.password))
#     db.add(u); db.commit(); db.refresh(u)
#     return UserRead(id=u.id, email=u.email)

# @router.post("/token", response_model=TokenResponse)
# def token(response: Response, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
#     u = db.query(User).filter(User.email == form.username).first()
#     if not u or not verify_password(form.password, u.password_hash):
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
#     jwt = create_access_token(u.id)
#     set_access_cookie(response, jwt)              # <-- set HttpOnly cookie
#     return TokenResponse(access_token=jwt)        # optional to also return JSON

# # @router.post("/token", response_model=TokenResponse)
# # def token(response: Response,
# #           form: OAuth2PasswordRequestForm = Depends(),
# #           db: Session = Depends(get_db)):
# #     # OAuth2 form uses "username" — you’re using email as the username
# #     u = db.query(User).filter(User.email == form.username).first()
# #     # NOTE: u.password_hash may be NULL for Google-only accounts → treat as invalid for password flow
# #     if not u or not u.password_hash or not verify_password(form.password, u.password_hash):
# #         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

# #     jwt = create_access_token(u.id)

# #     # Set HttpOnly auth cookie (browser sends it automatically on same-origin requests)
# #     response.set_cookie("access_token", jwt, **cookie_settings())

# #     # Optional: still return the token in the JSON body for old code paths
# #     return TokenResponse(access_token=jwt)
# @router.post("/logout", status_code=204)
# def logout(response: Response):
#     clear_access_cookie(response)
# # @router.post("/logout", status_code=204)
# # def logout(response: Response):
# #     # Delete the auth cookie
# #     response.delete_cookie("access_token", path="/")
# #     return Response(status_code=204)

# # from fastapi import APIRouter, Depends, HTTPException, status
# # from fastapi.security import OAuth2PasswordRequestForm
# # from sqlalchemy.orm import Session

# # from app.database import get_db
# # from app.models import User
# # from app.security import hash_password, verify_password, create_access_token
# # from app.schemas import RegisterRequest, UserRead, TokenResponse

# # from fastapi import Response
# # from app.security_cookies import cookie_settings
# # from app.security import create_access_token

# # router = APIRouter(prefix="/auth", tags=["auth"])

# # @router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
# # def register(payload: RegisterRequest, db: Session = Depends(get_db)):
# #     if db.query(User).filter(User.email == payload.email).first():
# #         raise HTTPException(status_code=400, detail="Email already registered")
# #     u = User(email=payload.email, password_hash=hash_password(payload.password))
# #     db.add(u); db.commit(); db.refresh(u)
# #     return UserRead(id=u.id, email=u.email)

# # @router.post("/token", response_model=TokenResponse)
# # def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
# #     # OAuth2 spec calls it "username"; we use email as the username
# #     u = db.query(User).filter(User.email == form.username).first()
# #     if not u or not verify_password(form.password, u.password_hash):
# #         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
# #     return TokenResponse(access_token=create_access_token(u.id))
