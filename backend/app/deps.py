# app/deps.py
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_token
from app.security_cookies import COOKIE_NAME

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
    token = request.cookies.get(COOKIE_NAME)
    return _user_from_token(token, db)

def get_current_user_any(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Accept either Authorization: Bearer or HttpOnly cookie.

    - Prefer a valid Bearer token when present (helps Safari/iOS where
      cross-site cookies may be blocked).
    - Otherwise, fall back to the cookie.
    """
    # Try Authorization header first
    if creds and (creds.scheme or "").lower() == "bearer":
        try:
            return _user_from_token(creds.credentials, db)
        except HTTPException:
            # Fall through to cookie
            pass
    # Cookie fallback
    token = request.cookies.get(COOKIE_NAME)
    return _user_from_token(token, db)


