# app/main.py
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

from app.routers.lists import router as lists_router
from app.routers.auth import router as auth_router
from app.routers.auth_google import router as google_router
from starlette.middleware.sessions import SessionMiddleware
from app.routers.me import router as me_router

import os
import sqlalchemy

DATABASE_URL = os.getenv("DATABASE_URL", "")
app = FastAPI(
    title="SmartGrocery Lite API",
    version="0.1.0"
)

# # Mount your lists router at /lists
# app.include_router(lists_router, prefix="/lists", tags=["lists"])

# mount your /lists endpoints
app.include_router(lists_router)
app.include_router(auth_router)
app.include_router(google_router)
app.include_router(me_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # dev server origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sessions (needed for Google OAuth redirect flow)
SESSION_SECRET = os.getenv("SESSION_SECRET", os.getenv("SECRET_KEY", "dev-insecure"))
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",     # good default
    https_only=False,    # set True in production w/ HTTPS
    max_age=60*60*24*7,  # 7 days
)


#Checking connection to database
engine = sqlalchemy.create_engine(os.getenv("DATABASE_URL"))
with engine.connect() as conn:
    result = conn.execute(sqlalchemy.text("SELECT 1"))
    print("DB connectivity OK:", result.scalar())


@app.get("/")
def read_root():
    return {"message": "Welcome to SmartGrocery Lite API"}



@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

