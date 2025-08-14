# backend/tests/test_lists.py
def test_create_list_uses_default_user(client):
    # owner_id omitted -> should auto-use DEFAULT_USER_EMAIL user
    r = client.post("/lists/", json={"name": "Monday"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "Monday"
    assert isinstance(data["owner_id"], int)

def test_read_lists_returns_created_list(client):
    # create
    client.post("/lists/", json={"name": "Groceries"})
    # read
    r = client.get("/lists/")
    assert r.status_code == 200
    names = [x["name"] for x in r.json()]
    assert "Groceries" in names

def test_add_item_and_list_items(client):
    # create a list first
    r = client.post("/lists/", json={"name": "Tuesday"})
    list_id = r.json()["id"]

    # add item
    r2 = client.post(f"/lists/{list_id}/items", json={"name": "Milk", "quantity": 2})
    assert r2.status_code == 200, r2.text
    item = r2.json()
    assert item["name"] == "Milk"
    assert item["quantity"] == 2
    assert item["list_id"] == list_id

    # list items
    r3 = client.get(f"/lists/{list_id}/items")
    assert r3.status_code == 200
    items = r3.json()
    assert any(i["name"] == "Milk" and i["quantity"] == 2 for i in items)

def test_delete_item(client):
    # new list
    r = client.post("/lists/", json={"name": "Wednesday"})
    list_id = r.json()["id"]

    # add item
    r2 = client.post(f"/lists/{list_id}/items", json={"name": "Eggs", "quantity": 12})
    item_id = r2.json()["id"]

    # delete
    r3 = client.delete(f"/lists/items/{item_id}")
    assert r3.status_code == 204

    # confirm it’s gone
    r4 = client.get(f"/lists/{list_id}/items")
    assert r4.status_code == 200
    items = r4.json()
    assert all(i["id"] != item_id for i in items)
