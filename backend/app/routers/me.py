# backend/app/routers/me.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserProfileRead, UserMeUpdate
from app.deps import get_current_user_cookie as get_current_user

router = APIRouter(tags=["me"])

@router.get("/me", response_model=UserProfileRead)
def get_me(current: User = Depends(get_current_user)):
    return current

@router.patch("/me", response_model=UserProfileRead)
def update_me(
    payload: UserMeUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Only update fields that were provided in the JSON body
    data = payload.model_dump(exclude_unset=True)  # includes keys even if their value is None

    if "name" in data:
        # store None when blank
        current.name = (data["name"] or None)

    if "picture" in data:
        # store None when blank
        current.picture = (data["picture"] or None)

    db.commit()
    db.refresh(current)
    return current


# # app/routers/me.py  (you said you already have /me GET)
# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session
# from app.database import get_db
# from app.models import User
# from app.deps import get_current_user_cookie as get_current_user
# from pydantic import BaseModel, AnyUrl

# router = APIRouter(prefix="/me", tags=["me"])

# class MeRead(BaseModel):
#   id: int
#   email: str
#   name: str | None = None
#   picture: str | None = None
#   google_sub: str | None = None
#   class Config: from_attributes = True

# class MeUpdate(BaseModel):
#   name: str | None = None
#   picture: str | None = None

# @router.get("", response_model=MeRead)
# def me(current: User = Depends(get_current_user)):
#   return current

# @router.patch("", response_model=MeRead)
# def update_me(payload: MeUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
#   changed = False
#   if payload.name is not None and payload.name != current.name:
#     current.name = payload.name; changed = True
#   if payload.picture is not None and payload.picture != current.picture:
#     current.picture = payload.picture; changed = True
#   if changed:
#     db.commit(); db.refresh(current)
#   return current
