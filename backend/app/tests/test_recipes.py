"""Tests for the M4 recipes router: read endpoints + add-to-list."""
from unittest.mock import patch

import pytest

from app.catalog import meal_client as meal_mod
from app.models import GroceryList, ListItem, ListShare, ShareRole, User
# Re-use the existing test DB sessionmaker from conftest
from app.tests.conftest import TestingSessionLocal as _Session


def _create_list(user_id: int, name: str = "List A") -> int:
    with _Session() as db:
        gl = GroceryList(name=name, owner_id=user_id)
        db.add(gl)
        db.commit()
        db.refresh(gl)
        return gl.id


async def fake_search_by_name(_client, q):
    if not q:
        return []
    if "chicken" in q.lower():
        return [{
            "external_id": "52772",
            "title": "Teriyaki Chicken Casserole",
            "image_url": "https://example.com/c.jpg",
            "category": "Chicken",
            "area": "Japanese",
            "source_url": "https://example.com/src",
        }]
    return []


async def fake_search_by_ingredient(_client, ingredient):
    if (ingredient or "").lower() == "chicken":
        return [{
            "external_id": "52772",
            "title": "Teriyaki Chicken Casserole",
            "image_url": "https://example.com/c.jpg",
            "category": None,
            "area": None,
            "source_url": None,
        }]
    return []


async def fake_lookup(_client, external_id):
    if external_id == "52772":
        return {
            "external_id": "52772",
            "title": "Teriyaki Chicken Casserole",
            "image_url": "https://example.com/c.jpg",
            "source_url": "https://example.com/src",
            "category": "Chicken",
            "area": "Japanese",
            "summary": None,
            "servings": 4,
            "ready_minutes": 45,
            "ingredients": [
                {"name": "soy sauce",    "measure": "3/4 cup",   "original": "3/4 cup soy sauce",    "aisle": "Condiments", "position": 0},
                {"name": "water",        "measure": "1/2 cup",   "original": "1/2 cup water",        "aisle": "Beverages",  "position": 1},
                {"name": "brown sugar",  "measure": "1/4 cup",   "original": "1/4 cup brown sugar",  "aisle": "Pantry",     "position": 2},
                {"name": "ground ginger","measure": "1/2 tsp",   "original": "1/2 tsp ground ginger","aisle": "Spices",     "position": 3},
                {"name": "minced garlic","measure": "1 tsp",     "original": "1 tsp minced garlic",  "aisle": "Produce",    "position": 4},
                {"name": "chicken",      "measure": "1 lb",      "original": "1 lb chicken",         "aisle": "Meat",       "position": 5},
                {"name": "broccoli",     "measure": None,        "original": "broccoli",             "aisle": "Produce",    "position": 6},
                {"name": "",             "measure": None,        "original": "",                     "aisle": None,         "position": 7},
            ],
        }
    if external_id == "EMPTY":
        return {
            "external_id": "EMPTY",
            "title": "Empty Recipe",
            "image_url": None,
            "source_url": None,
            "category": None,
            "area": None,
            "summary": None,
            "servings": None,
            "ready_minutes": None,
            "ingredients": [],
        }
    return None


@pytest.fixture(autouse=True)
def _patch_meal_client(monkeypatch):
    """Patch the meal client module functions used by the recipes router."""
    monkeypatch.setattr(meal_mod, "search_by_name", fake_search_by_name)
    monkeypatch.setattr(meal_mod, "search_by_ingredient", fake_search_by_ingredient)
    monkeypatch.setattr(meal_mod, "lookup", fake_lookup)
    # The router also needs `request.app.state.http` to be a non-None object
    # because the clients accept it. Patch the router's local reference to
    # the module functions (which we've already done), so the http object is
    # only forwarded to AsyncMocks. Provide a sentinel:
    from app.main import app
    class _DummyHTTP:
        pass
    app.state.http = _DummyHTTP()
    yield


def test_recipe_search_by_name(client, test_user):
    r = client.get("/recipes/search?q=chicken")
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["title"] == "Teriyaki Chicken Casserole"
    assert rows[0]["external_id"] == "52772"


def test_recipe_search_by_ingredient(client, test_user):
    r = client.get("/recipes/search?ingredient=chicken")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["external_id"] == "52772"


def test_recipe_search_no_params_returns_empty(client, test_user):
    """No param at all returns [] (200), not 400, so the FE can render an
    empty state without a noisy error.
    """
    r = client.get("/recipes/search")
    assert r.status_code == 200
    assert r.json() == []


def test_recipe_search_blank_param_returns_empty(client, test_user):
    """`?q=` is normalized to None and the endpoint returns [] without
    calling the upstream (no results, no error).
    """
    r = client.get("/recipes/search?q=")
    assert r.status_code == 200
    assert r.json() == []


def test_recipe_detail(client, test_user):
    r = client.get("/recipes/52772")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["title"] == "Teriyaki Chicken Casserole"
    # The fake lookup returns 8 ingredients (including one blank);
    # the lookup passes them all through.
    assert len(body["ingredients"]) == 8


def test_recipe_detail_404(client, test_user):
    r = client.get("/recipes/does-not-exist")
    assert r.status_code == 404


def test_add_to_list_creates_items(client, test_user):
    lid = _create_list(test_user.id)
    r = client.post(f"/recipes/52772/to-list/{lid}")
    assert r.status_code == 201, r.text
    body = r.json()
    # The fake has 8 ingredients; one is blank and gets reported in `skipped`.
    assert body["added"] == 7
    assert "" in body["skipped"]
    with _Session() as db:
        items = db.query(ListItem).filter(ListItem.list_id == lid).all()
        assert len(items) == 7
        names = {i.name for i in items}
        assert "soy sauce" in names
        assert "chicken" in names
        assert "broccoli" in names
        # Auto-categorization ran
        chicken = next(i for i in items if i.name == "chicken")
        assert chicken.category and chicken.category.startswith("meat")


def test_add_to_list_quantity_parsing(client, test_user):
    lid = _create_list(test_user.id)
    client.post(f"/recipes/52772/to-list/{lid}")
    with _Session() as db:
        items = db.query(ListItem).filter(ListItem.list_id == lid).all()
        by_name = {i.name: i for i in items}
        assert by_name["water"].quantity == 1            # 1/2 -> 1 (rounded)
        assert by_name["soy sauce"].quantity == 1        # 3/4 -> 1 (rounded)
        assert by_name["chicken"].quantity == 1          # 1 lb -> 1
        assert by_name["minced garlic"].quantity == 1    # 1 tsp -> 1
        assert by_name["broccoli"].quantity == 1         # None -> 1


def test_add_to_list_unknown_recipe(client, test_user):
    lid = _create_list(test_user.id)
    r = client.post(f"/recipes/UNKNOWN/to-list/{lid}")
    assert r.status_code == 404


def test_add_to_list_unknown_list(client, test_user):
    r = client.post("/recipes/52772/to-list/9999")
    assert r.status_code == 404


def test_add_to_list_no_edit_rights(client, test_user):
    """A second user (with read-only share) should get 403."""
    with _Session() as db:
        u_b = User(email="b@example.com", password_hash="x")
        db.add(u_b)
        db.commit()
        db.refresh(u_b)
        gl = GroceryList(name="List B", owner_id=u_b.id)
        db.add(gl)
        db.commit()
        db.refresh(gl)
        share = ListShare(list_id=gl.id, user_id=test_user.id, role=ShareRole.viewer)
        db.add(share)
        db.commit()
        bid = gl.id
    r = client.post(f"/recipes/52772/to-list/{bid}")
    assert r.status_code == 403


def test_add_to_list_works_for_owner(client, test_user):
    lid = _create_list(test_user.id)
    r = client.post(f"/recipes/52772/to-list/{lid}")
    assert r.status_code == 201


def test_add_to_list_empty_recipe(client, test_user):
    lid = _create_list(test_user.id)
    r = client.post(f"/recipes/EMPTY/to-list/{lid}")
    assert r.status_code == 201
    body = r.json()
    assert body["added"] == 0
    assert body["skipped"] == []
