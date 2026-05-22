# backend/app/schemas.py
from datetime import date, datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _strip_required_text(value):
    if isinstance(value, str):
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
    return value


def _strip_optional_text(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


# ----- Lists / Items -----
class ListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    owner_id: Optional[int] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return _strip_required_text(v)

class ListRead(BaseModel):
    id: int
    name: str
    owner_id: int
    # include created_at if your model has it (safe if DB column exists)
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class ListUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return _strip_required_text(v)

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(default=1, ge=1, le=9999)
    expiry: Optional[date] = None
    description: Optional[str] = Field(default=None, max_length=500)
    remind_on: Optional[date] = None
    purchased: Optional[bool] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return _strip_required_text(v)

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v):
        return _strip_optional_text(v)

class ItemRead(BaseModel):
    id: int
    name: str
    quantity: int
    expiry: Optional[date]
    list_id: int
    description: Optional[str] = None
    remind_on: Optional[date] = None
    purchased: bool = False
    model_config = ConfigDict(from_attributes=True)

class ItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    quantity: Optional[int] = Field(default=None, ge=1, le=9999)
    expiry: Optional[date] = None
    description: Optional[str] = Field(default=None, max_length=500)
    remind_on: Optional[date] = None
    purchased: Optional[bool] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        if v is None:
            return None
        return _strip_required_text(v)

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v):
        return _strip_optional_text(v)

# ----- Auth / Profile -----
class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., examples=["alice@example.com"])
    password: str = Field(..., min_length=8, max_length=128, examples=["pass12345"])

class UserRead(BaseModel):
    id: int
    email: EmailStr

class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"

class UserProfileRead(BaseModel):
    id: int
    email: EmailStr
    name: Optional[str] = None
    picture: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UserMeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    picture: Optional[str] = Field(default=None, max_length=2048)

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
