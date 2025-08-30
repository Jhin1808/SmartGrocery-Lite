# backend/app/models.py
from datetime import date
from sqlalchemy import (
    Column, String, Integer, Date, DateTime, Boolean, ForeignKey, func
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum
from sqlalchemy import Enum as SAEnum, UniqueConstraint


class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True)

    # Password auth (nullable so Google-only users are fine)
    password_hash = Column(String, nullable=True)

    # Core identity
    email = Column(String, unique=True, index=True, nullable=False)

    # Google SSO link. We’ll enforce uniqueness via Alembic partial index,
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

    # 👇 add/ensure this line exists
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
# class GroceryList(Base):
#     __tablename__ = "grocery_list"

#     id = Column(Integer, primary_key=True)
#     name = Column(String, nullable=False)
#     created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

#     owner_id = Column(
#         Integer,
#         ForeignKey("user.id", ondelete="CASCADE"),
#         nullable=False,
#     )
    
#     shares = relationship(
#         "ListShare",
#         back_populates="list",
#         cascade="all, delete-orphan",
#         passive_deletes=True,
#     )
    
#     owner = relationship("User", back_populates="lists")
#     items = relationship(
#         "ListItem",
#         back_populates="grocery_list",
#         cascade="all, delete-orphan",
#         passive_deletes=True,
#     )

class ListItem(Base):
    __tablename__ = "list_item"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    expiry = Column(Date, nullable=True)
    # Optional longer notes/description for the item
    description = Column(String, nullable=True)

    list_id = Column(
        Integer,
        ForeignKey("grocery_list.id", ondelete="CASCADE"),
        nullable=False,
    )

    grocery_list = relationship("GroceryList", back_populates="items")
    
    
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
