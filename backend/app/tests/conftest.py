import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# The app reads DATABASE_URL while importing app.database.
os.environ.setdefault("DATABASE_URL", "sqlite:///./.pytest-test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-suite-32-bytes")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-for-suite-32")

from app.main import app
from app.database import get_db
from app.deps import get_current_user_any
from app.models import Base, User

TEST_DB_URL = "sqlite:///./.pytest-test.db"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def _get_test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# override the app's DB dependency to use our sqlite test DB
app.dependency_overrides[get_db] = _get_test_db


@pytest.fixture()
def test_user():
    db = TestingSessionLocal()
    try:
        user = User(email="testuser@example.com", password_hash="test-hash")
        db.add(user)
        db.commit()
        db.refresh(user)
        return User(id=user.id, email=user.email, password_hash=user.password_hash)
    finally:
        db.close()


@pytest.fixture()
def client(test_user):
    app.dependency_overrides[get_current_user_any] = lambda: test_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user_any, None)
