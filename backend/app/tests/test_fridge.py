from unittest.mock import patch
from app.models import FridgeItem, GroceryList, ListItem, User
from app.tests.conftest import TestingSessionLocal


def test_fridge_validation_and_ownership(client, test_user):
    assert client.post("/fridge", json={"name": "  "}).status_code == 422
    assert client.post("/fridge", json={"name": "Eggs", "quantity": 0}).status_code == 422
    r = client.post("/fridge", json={"name": " Eggs ", "quantity": 6})
    assert r.status_code == 201
    item_id = r.json()["id"]
    assert client.get("/fridge").json()[0]["name"] == "Eggs"
    with TestingSessionLocal() as db:
        other = User(email="other@example.com")
        db.add(other); db.flush()
        food = FridgeItem(owner_id=other.id, name="Milk", quantity=1, unit="items")
        db.add(food); db.commit(); db.refresh(food)
        foreign_id = food.id
    assert len(client.get("/fridge").json()) == 1
    assert client.put(f"/fridge/{foreign_id}", json={"name": "Taken"}).status_code == 404
    assert client.delete(f"/fridge/{foreign_id}").status_code == 404
    assert client.put(f"/fridge/{item_id}", json={"name": "Eggs", "quantity": 3}).json()["quantity"] == 3
    assert client.delete(f"/fridge/{item_id}").status_code == 204


async def search(*args):
    return [{"external_id": "123"}]

async def lookup(*args):
    return {"external_id": "123", "title": "Dinner", "ingredients": [
        {"name": "Eggs", "original": "2 Eggs"},
        {"name": "Tomatoes", "original": "2 Tomatoes"},
        {"name": "Salt", "original": "1 pinch Salt"}]}


def test_meals_exclude_expired_and_add_only_missing(client, test_user):
    client.post("/fridge", json={"name": "Eggs"})
    client.post("/fridge", json={"name": "Tomatoes", "expiry": "2000-01-01"})
    assert client.get("/fridge/meals/suggestions?ingredient=Tomatoes").status_code == 422
    with TestingSessionLocal() as db:
        gl = GroceryList(name="Dinner", owner_id=test_user.id)
        db.add(gl); db.commit(); db.refresh(gl); list_id = gl.id
        db.add(ListItem(list_id=list_id, name="Salt", quantity=1)); db.commit()
    with patch("app.catalog.meal_client.search_by_ingredient", search), patch("app.catalog.meal_client.lookup", lookup):
        r = client.get("/fridge/meals/suggestions?ingredient=Eggs")
        assert r.status_code == 200
        assert len(r.json()[0]["have"]) == 1
        assert len(r.json()[0]["missing"]) == 2
        r = client.post(f"/fridge/meals/123/to-list/{list_id}")
        assert r.json()["added"] == 1
        with TestingSessionLocal() as db:
            added = db.query(ListItem).filter_by(list_id=list_id, name="Tomatoes").one()
            assert added.purchased is False
        assert client.post(f"/fridge/meals/123/to-list/{list_id}").json()["added"] == 0
        assert client.post("/fridge/meals/123/to-list/9999").status_code == 404


def test_missing_ingredients_respects_list_edit_permissions(client, test_user):
    with TestingSessionLocal() as db:
        other = User(email="another@example.com")
        db.add(other); db.flush()
        gl = GroceryList(name="Private", owner_id=other.id)
        db.add(gl); db.commit(); db.refresh(gl)
        list_id = gl.id
    assert client.post(f"/fridge/meals/123/to-list/{list_id}").status_code == 403
