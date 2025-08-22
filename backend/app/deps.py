from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from app.database import get_db
from app.models import User
from app.security import decode_token

bearer_scheme = HTTPBearer()

# app/deps.py
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.security import decode_token

def get_current_user_cookie(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("access_token")
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

