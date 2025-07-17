# app/main.py
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
import os
import sqlalchemy

DATABASE_URL = os.getenv("DATABASE_URL", "")
app = FastAPI()

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
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}
