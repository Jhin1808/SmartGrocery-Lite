# app/deps.py
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_token

# OAuth2 "password" flow helper (if you still support Authorization: Bearer from localStorage)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# Simple Bearer header parser (optional, if you want to accept raw Authorization: Bearer)
bearer_scheme = HTTPBearer(auto_error=False)

def _user_from_token(token: str, db: Session) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    user = db.get(User, int(sub)) if sub else None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    return user

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    """For OAuth2PasswordBearer (Authorization header) usage."""
    return _user_from_token(token, db)

def get_current_user_bearer(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Alternate Bearer header dependency (auto_error=False)."""
    if not creds or (creds.scheme or "").lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _user_from_token(creds.credentials, db)

def get_current_user_cookie(request: Request, db: Session = Depends(get_db)) -> User:
    """Cookie-based auth: read JWT from HttpOnly cookie."""
    token = request.cookies.get("access_token")
    return _user_from_token(token, db)


# # app/deps.py
# from fastapi import Depends, HTTPException, Request, status
# from sqlalchemy.orm import Session
# from app.database import get_db
# from app.models import User
# from app.security import decode_token

# def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
#     token = request.cookies.get("access_token")
#     if not token:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
#     try:
#         payload = decode_token(token)
#         sub = payload.get("sub")
#     except Exception:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
#     user = db.get(User, int(sub)) if sub else None
#     if not user:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
#     return user



# # app/deps.py
# from fastapi import Depends, HTTPException, Request, status
# from sqlalchemy.orm import Session
# from app.database import get_db
# from app.models import User
# from app.security import decode_token
# import os

# COOKIE_NAME = os.getenv("COOKIE_NAME", "access_token")

# def get_current_user_cookie(request: Request, db: Session = Depends(get_db)) -> User:
#     token = request.cookies.get(COOKIE_NAME)
#     if not token:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
#     try:
#         payload = decode_token(token)
#         sub = payload.get("sub")
#     except Exception:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
#     user = db.get(User, int(sub)) if sub else None
#     if not user:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
#     return user




# def get_current_user(
#     db: Session = Depends(get_db),
#     credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
# ) -> User:
#     token = credentials.credentials
#     try:
#         payload = decode_token(token)
#     except jwt.PyJWTError:
#         raise HTTPException(status_code=401, detail="Invalid token", headers={"WWW-Authenticate": "Bearer"})
#     sub = payload.get("sub")
#     try:
#         user_id = int(sub)
#     except (TypeError, ValueError):
#         raise HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
#     user = db.get(User, user_id)
#     if not user:
#         raise HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
#     return user


# from fastapi import Depends, HTTPException
# from fastapi.security import OAuth2PasswordBearer
# from sqlalchemy.orm import Session
# import jwt

# from app.database import get_db
# from app.models import User
# from app.security import decode_token

# oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token")

# def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2)) -> User:
#     try:
#         payload = decode_token(token)
#     except jwt.PyJWTError:
#         # bad signature / expired
#         raise HTTPException(status_code=401, detail="Invalid token", headers={"WWW-Authenticate": "Bearer"})
#     sub = payload.get("sub")
#     try:
#         user_id = int(sub)
#     except (TypeError, ValueError):
#         raise HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
#     user = db.get(User, user_id)
#     if not user:
#         raise HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
#     return user

# from fastapi import Depends, HTTPException, status
# from fastapi.security import OAuth2PasswordBearer
# from sqlalchemy.orm import Session
# import jwt

# from app.database import get_db
# from app.models import User
# from app.security import decode_token

# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# def get_current_user(
#     db: Session = Depends(get_db),
#     token: str = Depends(oauth2_scheme),
# ) -> User:
#     credentials_exc = HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="Could not validate credentials",
#         headers={"WWW-Authenticate": "Bearer"},
#     )
#     try:
#         payload = decode_token(token)  # may raise ExpiredSignatureError, InvalidTokenError, etc.
#         sub = payload.get("sub")
#         if not sub:
#             raise credentials_exc
#         try:
#             user_id = int(sub)
#         except (TypeError, ValueError):
#             raise credentials_exc
#         user = db.get(User, user_id)
#         if not user:
#             raise credentials_exc
#         return user
#     except jwt.ExpiredSignatureError:
#         # token was valid but has expired
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Token expired",
#             headers={"WWW-Authenticate": "Bearer"},
#         )
#     except jwt.PyJWTError:
#         # any other token error
#         raise credentials_exc

