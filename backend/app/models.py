# backend/app/models.py
from datetime import date
from sqlalchemy import Column, String, Integer, Date, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship

class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)

    # One-to-many: a user can own many lists
    lists = relationship("GroceryList", back_populates="owner")

class GroceryList(Base):
    __tablename__ = "grocery_list"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("user.id"), nullable=False)

    # Many-to-one: each list has one owner
    owner = relationship("User", back_populates="lists")
    # One-to-many: a list contains many items
    items = relationship("ListItem", back_populates="grocery_list")

class ListItem(Base):
    __tablename__ = "list_item"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    expiry = Column(Date, nullable=True)
    list_id = Column(Integer, ForeignKey("grocery_list.id"), nullable=False)

    # Many-to-one: each item belongs to one grocery list
    grocery_list = relationship("GroceryList", back_populates="items")
