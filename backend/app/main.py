# app/main.py
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from app.routers.lists import router as lists_router
from app.routers.auth import router as auth_router

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # dev server origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
