# backend/app/models.py
from datetime import date
from sqlalchemy import Column, String, Integer, Date, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship

from argon2 import PasswordHasher
from jwt import PyJWTError



class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True)
    #adding hash password
    password_hash = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)

    # one-to-many
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
    owner_id = Column(
        Integer,
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,                     # <- make this not-null in DB too
    )

    owner = relationship("User", back_populates="lists")
    
    items = relationship(
        "ListItem",
        back_populates="grocery_list",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class ListItem(Base):
    __tablename__ = "list_item"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    expiry = Column(Date, nullable=True)
    list_id = Column(
        Integer,
        ForeignKey("grocery_list.id", ondelete="CASCADE"),
        nullable=False,
    )

    grocery_list = relationship("GroceryList", back_populates="items")