# backend/app/database.py

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.models import Base, User  # adjust import as needed

DATABASE_URL = os.getenv("DATABASE_URL")

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create a configured "Session" class
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    """
    Dependency for FastAPI routes that yields a database session,
    then closes it after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Create tables (and optionally seed a default user).
    """
    Base.metadata.create_all(bind=engine)
    # Optional seed logic here...
