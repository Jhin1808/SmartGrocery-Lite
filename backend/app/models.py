# Add an ORM & Database Migrations
# Using SQLModel (built on SQLAlchemy, integrates nicely with FastAPI)
from __future__ import annotations
from typing import List

from sqlalchemy import Column, String, true
from sqlalchemy import Table
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=true, index=true)


class GroceryList(Base):
    __tablename__ = "grocery_list"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("user.id"))
    owner = relationship("User", back_populates="lists")


lists = relationship("GroceryList", back_populates="owner")
