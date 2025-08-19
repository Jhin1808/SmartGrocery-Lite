# backend/app/schemas.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date
from pydantic import BaseModel, EmailStr, Field

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


# --- Auth ---
class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., examples=["alice@example.com"])
    password: str = Field(..., min_length=8, examples=["pass12345"])

class UserRead(BaseModel):
    id: int
    email: EmailStr

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"