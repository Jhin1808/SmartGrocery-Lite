# backend/app/schemas.py
from datetime import date, datetime
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
    # include created_at if your model has it (safe if DB column exists)
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class ListUpdate(BaseModel):
    name: str

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

    @field_validator("name", "picture", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("picture", mode="before")
    @classmethod
    def sanitize_picture(cls, v):
        if v is None:
            return None
        if not isinstance(v, str):
            return v
        s = v.strip()
        if not s or s.startswith("<"):
            return None
        # allow certain data URL image types only (no SVG)
        if s.startswith("data:"):
            head = s[5:45].lower()
            allowed = ("image/png", "image/jpeg", "image/gif", "image/webp")
            if any(head.startswith(t) for t in allowed):
                return s
            return None
        # allow http/https URLs; reject others
        try:
            from urllib.parse import urlparse
            p = urlparse(s)
            if p.scheme in ("http", "https") and bool(p.netloc):
                return s
        except Exception:
            pass
        return None

# ----- Sharing -----
class ShareCreate(BaseModel):
    email: EmailStr
    role: Literal["viewer", "editor"] = "viewer"

class ShareRead(BaseModel):
    id: int
    list_id: int
    user_id: int
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)

class ShareRoleUpdate(BaseModel):
    role: Literal["viewer", "editor"]

# Extended list shape for /lists/ (includes caller’s relationship)
class ListReadEx(ListRead):
    shared: bool = False
    role: Optional[Literal["owner", "viewer", "editor"]] = None
    hidden: Optional[bool] = None
