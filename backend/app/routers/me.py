# app/routers/me.py
from fastapi import APIRouter, Depends
from app.deps import get_current_user_cookie as get_current_user
from app.models import User

router = APIRouter(prefix="/me", tags=["me"])

@router.get("/")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "picture": user.picture}

