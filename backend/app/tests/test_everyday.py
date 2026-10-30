from datetime import date, timedelta
from uuid import uuid4
from sqlalchemy import select
from app.main import app
from app.deps import get_current_user_any
from app.models import User, GroceryList, ListItem, ListShare, ShareRole, Staple
from app.tests.conftest import TestingSessionLocal


def make_list(client, name="Weekly groceries"):
    response = client.post('/lists/', json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()['id']


def test_staples_normalize_names_and_quick_add_deduplicates(client):
    list_id = make_list(client)
    first = client.post('/everyday/staples', json={"name": "  Whole  Milk ", "quantity": 2})
    second = client.post('/everyday/staples', json={"name": "whole milk", "quantity": 1})
    assert first.status_code == second.status_code == 201
    assert first.json()['id'] == second.json()['id']
    payload = {"name": "Whole Milk", "quantity": 2, "list_id": list_id}
    assert client.post('/everyday/add', json=payload).json()['result'] == 'added'
    assert client.post('/everyday/add', json={**payload, 'name': ' whole milk '}).json()['result'] == 'already_present'
    items = client.get(f'/lists/{list_id}/items').json()
    assert len(items) == 1 and items[0]['quantity'] == 2
    assert len(client.get('/everyday').json()['staples']) == 1


def test_purchase_history_survives_deletion_and_is_not_duplicated(client):
    list_id = make_list(client)
    item = client.post(f'/lists/{list_id}/items', json={"name": "Milk", "quantity": 2}).json()
    assert client.get('/everyday').json()['recent'] == []
    for _ in range(2):
        assert client.patch(f'/lists/items/{item["id"]}', json={"purchased": True}).status_code == 200
    history = client.get('/everyday').json()['recent']
    assert len(history) == 1 and history[0]['name'] == 'Milk' and history[0]['quantity'] == 2
    client.delete(f'/lists/items/{item["id"]}')
    assert len(client.get('/everyday').json()['recent']) == 1


def test_weekly_restock_preserves_unrelated_and_pending_items_clears_old_dates(client):
    list_id = make_list(client)
    for name in ['Milk', 'Eggs']:
        client.post('/everyday/staples', json={'name': name, 'quantity': 2})
    milk = client.post(f'/lists/{list_id}/items', json={'name': 'Milk', 'quantity': 1, 'purchased': True,
        'expiry': '2020-01-01', 'remind_on': '2020-01-01'}).json()
    extra = client.post(f'/lists/{list_id}/items', json={'name': 'Birthday cake', 'quantity': 1, 'purchased': True}).json()
    result = client.post('/everyday/restock?on=2026-10-30', json={'list_id': list_id})
    assert result.status_code == 200, result.text
    assert result.json() == {'added': 1, 'restored': 1, 'already_present': 0, 'restored_item_ids': [milk['id']]}
    repeat = client.post('/everyday/restock?on=2026-10-30', json={'list_id': list_id})
    assert repeat.json() == {'added': 0, 'restored': 0, 'already_present': 2, 'restored_item_ids': []}
    items = client.get(f'/lists/{list_id}/items').json()
    assert len(items) == 3
    restored = next(item for item in items if item['id'] == milk['id'])
    assert not restored['purchased'] and restored['expiry'] is None and restored['remind_on'] is None
    assert next(item for item in items if item['id'] == extra['id'])['purchased']
    assert list_id in client.get('/everyday?on=2026-10-30').json()['restocked_list_ids']
    assert client.get('/everyday?on=2026-11-02').json()['restocked_list_ids'] == []


def test_use_first_only_bought_items_with_nearby_entered_dates(client):
    list_id = make_list(client)
    for name, days, bought in [('Spinach', 1, True), ('Old milk', -1, True), ('Pasta', 10, True), ('Not bought', 0, False)]:
        client.post(f'/lists/{list_id}/items', json={'name': name, 'quantity': 1, 'purchased': bought,
            'expiry': str(date(2026, 10, 30) + timedelta(days=days))})
    rows = client.get('/everyday?on=2026-10-30').json()['use_first']
    assert [row['name'] for row in rows] == ['Old milk', 'Spinach']
    assert [row['days_left'] for row in rows] == [-1, 1]


def test_demo_import_is_atomic_retry_safe_and_preserves_checkoffs(client):
    payload = {'import_key': str(uuid4()), 'name': 'My demo', 'items': [
        {'name': 'Milk', 'quantity': 2, 'purchased': True}, {'name': 'Eggs', 'purchased': False}]}
    first = client.post('/everyday/import-demo', json=payload)
    second = client.post('/everyday/import-demo', json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json()['list_id'] == second.json()['list_id']
    assert second.json()['already_imported']
    items = client.get(f'/lists/{first.json()["list_id"]}/items').json()
    assert len(items) == 2
    assert next(item for item in items if item['name'] == 'Milk')['purchased']
    assert len(client.get('/lists/').json()) == 1
    invalid = {**payload, 'import_key': str(uuid4()), 'items': [{'name': '  '}]}
    assert client.post('/everyday/import-demo', json=invalid).status_code == 422
    assert len(client.get('/lists/').json()) == 1


def test_shortcuts_require_edit_access_and_private_history_does_not_leak(client, test_user):
    owned = make_list(client)
    client.post('/everyday/staples', json={'name': 'Private staple'})
    client.post(f'/lists/{owned}/items', json={'name': 'Private purchase', 'purchased': True})
    db = TestingSessionLocal()
    other = User(email='other@example.com', password_hash='test')
    db.add(other); db.flush()
    other_id = other.id
    db.add(ListShare(list_id=owned, user_id=other_id, role=ShareRole.viewer))
    db.commit(); db.close()
    app.dependency_overrides[get_current_user_any] = lambda: User(id=other_id, email='other@example.com')
    try:
        overview = client.get('/everyday').json()
        assert overview['staples'] == [] and overview['recent'] == []
        assert client.post('/everyday/add', json={'list_id': owned, 'name': 'Nope'}).status_code == 404
        assert client.post('/everyday/restock', json={'list_id': owned}).status_code == 404
        assert client.delete('/everyday/staples/1').status_code == 404
        # An editor can add to a shared household list, without learning personal history.
        db = TestingSessionLocal(); share = db.scalar(select(ListShare).where(ListShare.user_id == other_id))
        share.role = ShareRole.editor; db.commit(); db.close()
        assert client.post('/everyday/add', json={'list_id': owned, 'name': 'Shared milk'}).status_code == 200
    finally:
        app.dependency_overrides[get_current_user_any] = lambda: test_user


def test_invalid_grocery_and_unknown_destination_are_rejected(client):
    assert client.post('/everyday/staples', json={'name': ' '}).status_code == 422
    assert client.post('/everyday/staples', json={'name': 'Milk', 'quantity': 0}).status_code == 422
    assert client.post('/everyday/add', json={'name': 'Milk', 'list_id': 99999}).status_code == 404


def test_restock_keeps_bought_dates_if_a_matching_pending_grocery_already_exists(client):
    list_id = make_list(client)
    client.post('/everyday/staples', json={'name': 'Milk'})
    bought = client.post(f'/lists/{list_id}/items', json={'name': 'Milk', 'purchased': True, 'expiry': '2026-10-31'}).json()
    client.post(f'/lists/{list_id}/items', json={'name': 'Milk', 'purchased': False})
    result = client.post('/everyday/restock?on=2026-10-30', json={'list_id': list_id}).json()
    assert result['already_present'] == 1 and result['restored_item_ids'] == []
    assert any(row['id'] == bought['id'] for row in client.get('/everyday?on=2026-10-30').json()['use_first'])
