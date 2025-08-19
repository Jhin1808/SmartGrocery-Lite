from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", status_code=201)
def register(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email"); password = payload.get("password")
    if not email or not password:
        raise HTTPException(400, "email and password required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    u = User(email=email, password_hash=hash_password(password))
    db.add(u); db.commit(); db.refresh(u)
    return {"id": u.id, "email": u.email}

@router.post("/token")
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # form.username = email (per OAuth2 spec)
    u = db.query(User).filter(User.email == form.username).first()
    if not u or not verify_password(form.password, u.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return {"access_token": create_access_token(u.id), "token_type": "bearer"}
