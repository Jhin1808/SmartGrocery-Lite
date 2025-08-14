from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlmodel import select
from app.database import get_db
from app.models import GroceryList

router = APIRouter(prefix="/lists", tags=["lists"])

@router.post("/")
def create_list(name: str, db: Session = Depends(get_db)):
    new = GroceryList(name=name, owner_id=1)
    db.add(new)
    db.commit()
    db.refresh(new)
    return new

@router.get("/")
def read_lists(db: Session = Depends(get_db)):
    return db.exec(select(GroceryList)).all()
