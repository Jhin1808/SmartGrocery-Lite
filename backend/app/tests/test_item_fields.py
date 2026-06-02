"""Item fields round-trip: POST a list item with all catalog fields, PATCH, GET."""
import pytest


def test_add_item_with_catalog_fields(client, test_user):
    # create list
    r = client.post("/lists/", json={"name": "Groceries"})
    assert r.status_code == 201, r.text
    list_id = r.json()["id"]

    # add item with all catalog fields
    payload = {
        "name": "Horizon Organic 2% Milk",
        "quantity": 2,
        "category": "dairy.milk",
        "subcategory": "fat-reduced",
        "weight_value": 0.5,
        "weight_unit": "gal",
        "brand": "Horizon",
        "barcode": "0744472631011",
        "product_image_url": "https://example.com/img.jpg",
        "price": 4.99,
        "price_source": "user",
        "description": "Half gallon",
    }
    r = client.post(f"/lists/{list_id}/items", json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    for k, v in payload.items():
        assert body[k] == v, f"{k}: got {body[k]!r}, expected {v!r}"
    assert body["list_id"] == list_id

    # GET round-trips
    r = client.get(f"/lists/{list_id}/items")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    for k, v in payload.items():
        assert items[0][k] == v

    # PATCH a subset
    item_id = items[0]["id"]
    r = client.patch(
        f"/lists/items/{item_id}",
        json={"price": 5.49, "weight_value": 1.0, "weight_unit": "gal"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["price"] == 5.49
    assert body["weight_value"] == 1.0
    assert body["weight_unit"] == "gal"
    # unchanged fields remain
    assert body["category"] == "dairy.milk"
    assert body["brand"] == "Horizon"


def test_add_item_auto_categorizes_plain_text(client, test_user):
    r = client.post("/lists/", json={"name": "L"})
    list_id = r.json()["id"]
    r = client.post(f"/lists/{list_id}/items", json={"name": "Banana"})
    assert r.status_code == 201
    body = r.json()
    # canonical path is stored in `category`
    assert body["category"] == "produce.fruit"
    # subcategory is the keyword hint (None for plain "Banana")
    assert body.get("subcategory") in (None, "")


def test_add_item_auto_categorizes_with_subcategory_hint(client, test_user):
    r = client.post("/lists/", json={"name": "L"})
    list_id = r.json()["id"]
    r = client.post(f"/lists/{list_id}/items", json={"name": "Horizon 2% Milk"})
    assert r.status_code == 201
    body = r.json()
    assert body["category"] in ("dairy.milk", "dairy.milk.2pct")
    assert body["subcategory"] == "fat-reduced"


def test_add_item_accepts_kroger_price_source(client, test_user):
    r = client.post("/lists/", json={"name": "L"})
    list_id = r.json()["id"]
    r = client.post(
        f"/lists/{list_id}/items",
        json={"name": "Kroger 2% Milk", "price": 3.29, "price_source": "kroger"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["price_source"] == "kroger"
    assert body["price"] == 3.29


def test_item_store_id_must_belong_to_current_user(client, test_user):
    from app.database import get_db
    from app.models import ConnectedStore, User

    db_override = client.app.dependency_overrides[get_db]
    db = next(db_override())
    try:
        other_user = User(email="other-store-owner@example.com", password_hash="x")
        db.add(other_user)
        db.flush()

        owned_store = ConnectedStore(
            user_id=test_user.id,
            source="kroger",
            chain="Kroger",
            location_id="owned-1",
            name="Owned Kroger",
        )
        other_store = ConnectedStore(
            user_id=other_user.id,
            source="kroger",
            chain="Kroger",
            location_id="other-1",
            name="Other Kroger",
        )
        db.add_all([owned_store, other_store])
        db.flush()
        owned_store_id = owned_store.id
        other_store_id = other_store.id
        db.commit()
    finally:
        db.close()

    r = client.post("/lists/", json={"name": "L"})
    assert r.status_code == 201, r.text
    list_id = r.json()["id"]

    r = client.post(
        f"/lists/{list_id}/items",
        json={"name": "Milk", "store_id": owned_store_id},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["store_id"] == owned_store_id
    item_id = body["id"]

    r = client.post(
        f"/lists/{list_id}/items",
        json={"name": "Eggs", "store_id": other_store_id},
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "Store not found"

    r = client.patch(
        f"/lists/items/{item_id}",
        json={"store_id": other_store_id},
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "Store not found"

    r = client.patch(
        f"/lists/items/{item_id}",
        json={"store_id": None},
    )
    assert r.status_code == 200, r.text
    assert r.json()["store_id"] is None
