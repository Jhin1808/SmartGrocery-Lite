# backend/app/schemas.py
from datetime import date
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ----- Lists / Items -----
class ListCreate(BaseModel):
    name: str
    owner_id: Optional[int] = None

class ListRead(BaseModel):
    id: int
    name: str
    owner_id: int
    model_config = ConfigDict(from_attributes=True)

class ItemCreate(BaseModel):
    name: str
    quantity: int = 1
    expiry: Optional[date] = None

class ItemRead(BaseModel):
    id: int
    name: str
    quantity: int
    expiry: Optional[date]
    list_id: int
    model_config = ConfigDict(from_attributes=True)

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    expiry: Optional[date] = None

# ----- Auth / Profile -----
class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., examples=["alice@example.com"])
    password: str = Field(..., min_length=8, examples=["pass12345"])

class UserRead(BaseModel):
    id: int
    email: EmailStr

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserProfileRead(BaseModel):
    id: int
    email: EmailStr
    name: Optional[str] = None
    picture: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UserMeUpdate(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None

    # Accept "" from the frontend and treat it as "clear this field"
    @field_validator("name", "picture", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

# ----- Sharing -----
class ShareCreate(BaseModel):
    email: EmailStr
    role: Literal["viewer", "editor"] = "viewer"

class ShareRead(BaseModel):
    id: int
    list_id: int
    user_id: int
    email: EmailStr
    role: Literal["viewer", "editor"]
    model_config = ConfigDict(from_attributes=True)

class ListUpdate(BaseModel):
    name: str
    
class ShareRoleUpdate(BaseModel):
    role: Literal["viewer","editor"]