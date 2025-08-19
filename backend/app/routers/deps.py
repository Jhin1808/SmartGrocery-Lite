from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from app.database import get_db
from app.models import User
from app.security import decode_token  # uses the same SECRET_KEY/ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)  # may raise ExpiredSignatureError, InvalidTokenError, etc.
        sub = payload.get("sub")
        if not sub:
            raise credentials_exc
        try:
            user_id = int(sub)
        except (TypeError, ValueError):
            raise credentials_exc
        user = db.get(User, user_id)
        if not user:
            raise credentials_exc
        return user
    except jwt.ExpiredSignatureError:
        # token was valid but has expired
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        # any other token error
        raise credentials_exc

