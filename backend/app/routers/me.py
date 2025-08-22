# app/routers/me.py
from fastapi import APIRouter, Depends
from app.models import User
from app.deps import get_current_user

router = APIRouter()

@router.get("/me")
def me(current: User = Depends(get_current_user)):
    return {"id": current.id, "email": current.email}
