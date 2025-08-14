# backend/tests/conftest.py
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models import Base

# use a file-based sqlite so multiple threads can access it
TEST_DB_URL = "sqlite:///./test.db"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},  # needed for sqlite + TestClient
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

@pytest.fixture(scope="session", autouse=True)
def _setup_db_once():
    # make sure default dev user email is predictable in tests
    os.environ.setdefault("DEFAULT_USER_EMAIL", "testuser@example.com")
    # fresh tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    # optional cleanup: comment out if you want to inspect test.db afterwards
    Base.metadata.drop_all(bind=engine)

def _get_test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# override the app's DB dependency to use our sqlite test DB
app.dependency_overrides[get_db] = _get_test_db

@pytest.fixture()
def client():
    return TestClient(app)
