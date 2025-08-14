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
    # create tables (no-op if they already exist)
    Base.metadata.create_all(bind=engine)

    # ensure default dev user exists
    default_email = os.getenv("DEFAULT_USER_EMAIL", "demo@example.com")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == default_email).first()
        if not user:
            user = User(email=default_email)
            db.add(user)
            db.commit()
    finally:
        db.close()