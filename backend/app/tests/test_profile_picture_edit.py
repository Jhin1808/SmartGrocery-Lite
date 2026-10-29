import pytest
from pydantic import ValidationError
from app.schemas import UserMeUpdate


def test_profile_schema_accepts_name_only():
    assert UserMeUpdate(name="Alex").model_dump(exclude_unset=True) == {"name": "Alex"}


def test_profile_schema_rejects_picture():
    with pytest.raises(ValidationError):
        UserMeUpdate(name="Alex", picture="https://example.com/upload.png")


def test_profile_endpoint_rejects_picture_edit(client):
    response = client.patch("/me", json={"picture": "https://example.com/upload.png"})
    assert response.status_code == 422
    assert any(error["loc"][-1] == "picture" for error in response.json()["detail"])
