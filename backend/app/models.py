# backend/app/models.py
from datetime import date, datetime
from sqlalchemy import (
    Column, String, Integer, Date, DateTime, Boolean, ForeignKey, func, Index,
    Float, Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum
from sqlalchemy import Enum as SAEnum, UniqueConstraint, JSON

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True)

    # Password auth (nullable so Google-only users are fine)
    password_hash = Column(String, nullable=True)

    # Core identity
    email = Column(String, unique=True, index=True, nullable=False)

    # Google SSO link. We enforce uniqueness via Alembic partial index,
    # so keep this non-unique at the model level and just index it.
    google_sub = Column(String, index=True, nullable=True)

    # Optional profile fields
    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)

    # Relationships
    lists = relationship(
        "GroceryList",
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class GroceryList(Base):
    __tablename__ = "grocery_list"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    owner = relationship("User", back_populates="lists")
    items = relationship(
        "ListItem",
        back_populates="grocery_list",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    shares = relationship(
        "ListShare",
        back_populates="list",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
class ListItem(Base):
    __tablename__ = "list_item"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    expiry = Column(Date, nullable=True)
    # Optional longer notes/description for the item
    description = Column(String, nullable=True)
    # Reminders
    remind_on = Column(Date, nullable=True)
    reminded_at = Column(DateTime(timezone=True), nullable=True)
    # Shopping state
    purchased = Column(Boolean, nullable=False, server_default="false")

    # --- Catalog fields (M1+) ---
    category = Column(String, nullable=True, index=True)
    subcategory = Column(String, nullable=True)
    weight_value = Column(Float, nullable=True)
    weight_unit = Column(String, nullable=True)
    brand = Column(String, nullable=True, index=True)
    barcode = Column(String, nullable=True, index=True)
    product_image_url = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    price_source = Column(String, nullable=True)   # "user" | "kroger" | "manual" | "off"
    store_id = Column(Integer, ForeignKey("connected_store.id", ondelete="SET NULL"), nullable=True)
    nutrition_json = Column(JSON, nullable=True)

    list_id = Column(
        Integer,
        ForeignKey("grocery_list.id", ondelete="CASCADE"),
        nullable=False,
    )

    grocery_list = relationship("GroceryList", back_populates="items")
    store = relationship("ConnectedStore", foreign_keys=[store_id])
    
class ShareRole(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"

class ListShare(Base):
    __tablename__ = "list_share"
    id = Column(Integer, primary_key=True)
    list_id = Column(Integer, ForeignKey("grocery_list.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)

    # name the SQL ENUM type to keep Alembic happy
    role = Column(SAEnum(ShareRole, name="share_role"), nullable=False, server_default="viewer")
    hidden = Column(Boolean, nullable=False, server_default="false")
    __table_args__ = (UniqueConstraint("list_id", "user_id", name="uq_list_share_list_user"),)

    user = relationship("User")
    list = relationship("GroceryList", back_populates="shares")

class PasswordResetCode(Base):
    __tablename__ = "password_reset_code"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    attempts = Column(Integer, nullable=False, server_default="0")

    # Helpful index for cleanup/queries
    __table_args__ = (
        Index("ix_prc_user_active", "user_id", "expires_at"),
    )

class UsedResetToken(Base):
    __tablename__ = "used_reset_token"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    jti = Column(String, nullable=False, unique=True, index=True)
    used_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)


# ---- Catalog / Recipes (M1+) ----

class ConnectedStore(Base):
    """A grocery store (typically a Kroger-family location) the user has linked
    to enable real-time price + aisle + stock lookups."""
    __tablename__ = "connected_store"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    # "kroger" today; reserved for future sources
    source = Column(String, nullable=False, server_default="kroger")
    chain = Column(String, nullable=False)             # e.g. "Kroger", "Ralphs"
    location_id = Column(String, nullable=False)      # upstream store id
    name = Column(String, nullable=False)             # human label
    address = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    connected_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "source", "location_id", name="uq_connected_store_user_source_loc"),
    )

    user = relationship("User")


class ProductCache(Base):
    """Server-side cache for proxied product lookups (OFF, Kroger, etc.).
    Key is a hash of (endpoint + sorted params)."""
    __tablename__ = "product_cache"

    key = Column(String, primary_key=True)
    source = Column(String, nullable=False)        # "off" | "kroger"
    endpoint = Column(String, nullable=False)      # e.g. "search", "barcode"
    payload = Column(JSON, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TaxonomyEntry(Base):
    """Local mirror of Open Food Facts category tree, mapped to a normalized
    canonical path. Seeded once via scripts/seed_taxonomy.py."""
    __tablename__ = "taxonomy_entry"

    id = Column(Integer, primary_key=True)
    slug = Column(String, unique=True, index=True, nullable=False)        # e.g. "en:fat-free-milks"
    canonical = Column(String, nullable=False, index=True)               # e.g. "dairy.milk.fat-free"
    display = Column(String, nullable=False)                             # e.g. "Dairy > Milk > Fat-Free"
    parent_slug = Column(String, nullable=True, index=True)
    # Top-level bucket used for color-coding the UI
    top_level = Column(String, nullable=True, index=True)


class Recipe(Base):
    """Cached recipe (TheMealDB today; reserved for paid sources later)."""
    __tablename__ = "recipe"

    id = Column(Integer, primary_key=True)
    external_id = Column(String, unique=True, index=True, nullable=False)
    source = Column(String, nullable=False, server_default="mealdb")
    title = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    servings = Column(Integer, nullable=True)
    ready_minutes = Column(Integer, nullable=True)
    category = Column(String, nullable=True)
    area = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    raw_json = Column(JSON, nullable=True)
    cached_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredient"

    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipe.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    measure = Column(String, nullable=True)
    original = Column(String, nullable=True)
    aisle = Column(String, nullable=True)
    position = Column(Integer, nullable=False, server_default="0")

    recipe = relationship("Recipe")


# ---- List Templates (M5) ----

class ListTemplate(Base):
    """Curated starter list. Admin-seeded; users can clone but not edit."""
    __tablename__ = "list_template"

    id = Column(Integer, primary_key=True)
    slug = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    description = Column(String(500), nullable=False, server_default="")
    # "meal" | "household" | "party" | "diet" | "lifestyle" — drives the
    # category filter and the visual accent on the FE.
    category = Column(String(40), nullable=True, index=True)
    # A short visual hint (single emoji or short label). Optional.
    emoji = Column(String(8), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    sort_index = Column(Integer, nullable=False, server_default="100")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    items = relationship(
        "ListTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ListTemplateItem.sort_index, ListTemplateItem.id",
    )


class ListTemplateItem(Base):
    __tablename__ = "list_template_item"

    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("list_template.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    # Suggested canonical category. Optional — auto_categorize runs on
    # clone for any item that doesn't have one.
    category = Column(String(64), nullable=True)
    quantity = Column(Integer, nullable=False, server_default="1")
    sort_index = Column(Integer, nullable=False, server_default="100")

    template = relationship("ListTemplate", back_populates="items")
