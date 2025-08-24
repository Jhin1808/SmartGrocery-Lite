# app/main.py
import os
import sqlalchemy
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.database import engine
from app.routers.lists import router as lists_router
from app.routers.auth import router as auth_router
from app.routers.auth_google import router as google_router
from app.routers.me import router as me_router

# One env only; can be single origin or comma-separated list
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in FRONTEND_URL.split(",") if o.strip()]

SESSION_SECRET = os.getenv("SESSION_SECRET", os.getenv("SECRET_KEY", "dev-insecure"))

app = FastAPI(title="SmartGrocery Lite API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # pass the list directly
    allow_credentials=True,          # cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site=os.getenv("COOKIE_SAMESITE", "lax").lower(),  # use "none" for cross-site prod
    https_only=os.getenv("COOKIE_SECURE", "false").lower() in ("1","true","yes"),
)

app.include_router(lists_router)
app.include_router(auth_router)
app.include_router(google_router)
app.include_router(me_router)

# Connectivity check
with engine.connect() as conn:
    conn.execute(sqlalchemy.text("SELECT 1"))

@app.get("/")
def root():
    return {"message": "Welcome to SmartGrocery Lite API"}
