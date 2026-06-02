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
    # Catalog fields (M1+)
    category: Optional[str] = Field(default=None, max_length=64)
    subcategory: Optional[str] = Field(default=None, max_length=64)
    weight_value: Optional[float] = Field(default=None, ge=0)
    weight_unit: Optional[str] = Field(default=None, max_length=8)
    brand: Optional[str] = Field(default=None, max_length=120)
    barcode: Optional[str] = Field(default=None, max_length=32)
    product_image_url: Optional[str] = Field(default=None, max_length=2048)
    price: Optional[float] = Field(default=None, ge=0)
    price_source: Optional[Literal["user", "kroger", "off", "manual"]] = None
    store_id: Optional[int] = Field(default=None, ge=1)
    nutrition_json: Optional[dict] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return _strip_required_text(v)

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v):
        return _strip_optional_text(v)

    @field_validator("product_image_url", mode="before")
    @classmethod
    def strip_image(cls, v):
        return _strip_optional_text(v)

    @field_validator("brand", "category", "subcategory", "weight_unit", "barcode", mode="before")
    @classmethod
    def strip_short(cls, v):
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
    # Catalog fields (M1+)
    category: Optional[str] = None
    subcategory: Optional[str] = None
    weight_value: Optional[float] = None
    weight_unit: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    product_image_url: Optional[str] = None
    price: Optional[float] = None
    price_source: Optional[str] = None
    store_id: Optional[int] = None
    nutrition_json: Optional[dict] = None
    model_config = ConfigDict(from_attributes=True)


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    quantity: Optional[int] = Field(default=None, ge=1, le=9999)
    expiry: Optional[date] = None
    description: Optional[str] = Field(default=None, max_length=500)
    remind_on: Optional[date] = None
    purchased: Optional[bool] = None
    # Catalog fields (M1+)
    category: Optional[str] = Field(default=None, max_length=64)
    subcategory: Optional[str] = Field(default=None, max_length=64)
    weight_value: Optional[float] = Field(default=None, ge=0)
    weight_unit: Optional[str] = Field(default=None, max_length=8)
    brand: Optional[str] = Field(default=None, max_length=120)
    barcode: Optional[str] = Field(default=None, max_length=32)
    product_image_url: Optional[str] = Field(default=None, max_length=2048)
    price: Optional[float] = Field(default=None, ge=0)
    price_source: Optional[Literal["user", "kroger", "off", "manual"]] = None
    store_id: Optional[int] = Field(default=None, ge=1)
    nutrition_json: Optional[dict] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        if v is None:
            return None
        return _strip_required_text(v)

    @field_validator("description", "product_image_url", mode="before")
    @classmethod
    def strip_text(cls, v):
        return _strip_optional_text(v)

    @field_validator("brand", "category", "subcategory", "weight_unit", "barcode", mode="before")
    @classmethod
    def strip_short(cls, v):
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


# ---- Catalog / Stores / Recipes (M1+) ----

class CatalogProductRead(BaseModel):
    """Normalized product shape returned by /catalog/* endpoints.
    Combines data from OFF and Kroger, marked by `source`."""
    source: Literal["off", "kroger"]
    code: Optional[str] = None              # barcode / upc
    name: str
    brand: Optional[str] = None
    image_url: Optional[str] = None
    categories: list[str] = []              # OFF category tags (raw)
    canonical: Optional[str] = None         # mapped canonical path, e.g. "dairy.milk"
    display: Optional[str] = None           # mapped display, e.g. "Dairy > Milk"
    weight_value: Optional[float] = None
    weight_unit: Optional[str] = None
    # Pricing (Kroger; OFF rarely has prices)
    price_regular: Optional[float] = None
    price_promo: Optional[float] = None
    aisle: Optional[str] = None
    stock_level: Optional[str] = None       # "HIGH" | "LOW" | None
    fulfillment: Optional[dict] = None      # {instore, shiptohome, delivery, curbside}


class CategoryNode(BaseModel):
    slug: str
    canonical: str
    display: str
    top_level: Optional[str] = None
    children: list["CategoryNode"] = []


CategoryNode.model_rebuild()


class ConnectedStoreRead(BaseModel):
    id: int
    source: str
    chain: str
    location_id: str
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    connected_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConnectedStoreCreate(BaseModel):
    chain: str
    location_id: str
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class KrogerLocationSummary(BaseModel):
    location_id: str
    chain: str
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    zip: Optional[str] = None


class KrogerChainSummary(BaseModel):
    name: str
    location_count: Optional[int] = None


class KrogerStatusRead(BaseModel):
    configured: bool
    connected_store: Optional[ConnectedStoreRead] = None


class RecipeSummaryRead(BaseModel):
    external_id: str
    title: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    area: Optional[str] = None
    source_url: Optional[str] = None


class RecipeIngredientRead(BaseModel):
    name: str
    measure: Optional[str] = None
    original: Optional[str] = None
    aisle: Optional[str] = None
    position: int = 0


class RecipeDetailRead(RecipeSummaryRead):
    servings: Optional[int] = None
    ready_minutes: Optional[int] = None
    summary: Optional[str] = None
    ingredients: list[RecipeIngredientRead] = []


class RecipeAddToListResponse(BaseModel):
    added: int
    skipped: list[str] = []


# ---- List Templates (M5) ----

class TemplateItemRead(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    quantity: int = 1
    sort_index: int = 0
    model_config = ConfigDict(from_attributes=True)


class TemplateSummaryRead(BaseModel):
    id: int
    slug: str
    name: str
    description: str = ""
    category: Optional[str] = None
    emoji: Optional[str] = None
    sort_index: int = 0
    item_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class TemplateDetailRead(TemplateSummaryRead):
    items: list[TemplateItemRead] = []


class TemplateCloneRequest(BaseModel):
    """Request to clone a template into a list. Exactly one of ``list_id``
    or ``list_name`` should be provided; if neither, a list named after
    the template is created.
    """
    list_id: Optional[int] = Field(default=None, ge=1)
    list_name: Optional[str] = Field(default=None, max_length=100)

    @field_validator("list_name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return _strip_optional_text(v)


class TemplateCloneResponse(BaseModel):
    list_id: int
    list_name: str
    created_list: bool
    added: int
    skipped: list[str] = []
