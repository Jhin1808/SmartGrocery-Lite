"""Tests for the M5 list-templates router."""
import pytest

from app.models import GroceryList, ListItem, ListShare, ListTemplate, ListTemplateItem, ShareRole, User
from app.templates_seed import ensure_templates_in_db, list_template_dicts
# Re-use the existing test DB sessionmaker from conftest
from app.tests.conftest import TestingSessionLocal as _Session


@pytest.fixture(autouse=True)
def _seed_templates():
    """Run the templates seed against the test DB before each test so
    /templates has data to work with.
    """
    with _Session() as db:
        ensure_templates_in_db(db)


def _create_list(user_id: int, name: str = "List A") -> int:
    with _Session() as db:
        gl = GroceryList(name=name, owner_id=user_id)
        db.add(gl)
        db.commit()
        db.refresh(gl)
        return gl.id


def _create_other_user_with_viewer_share(test_user_id: int) -> int:
    """Create a second user who owns a list, and share it to the test
    user as a viewer. Returns the list id."""
    with _Session() as db:
        u_b = User(email="b@example.com", password_hash="x")
        db.add(u_b)
        db.commit()
        db.refresh(u_b)
        gl = GroceryList(name="List B", owner_id=u_b.id)
        db.add(gl)
        db.commit()
        db.refresh(gl)
        share = ListShare(list_id=gl.id, user_id=test_user_id, role=ShareRole.viewer)
        db.add(share)
        db.commit()
        return gl.id


# ----- List -----

def test_list_templates_unauthenticated(client, test_user):
    """No auth -> the get_current_user_any dep raises -> 401/403 from FastAPI.
    We accept either as the contract: the route is protected.
    """
    app_depends = client.app.dependency_overrides
    from app.deps import get_current_user_any
    app_depends.pop(get_current_user_any, None)
    try:
        r = client.get("/templates")
        assert r.status_code in (401, 403)
    finally:
        app_depends[get_current_user_any] = lambda: test_user


def test_list_templates_returns_seeded(client, test_user):
    r = client.get("/templates")
    assert r.status_code == 200, r.text
    rows = r.json()
    slugs = {row["slug"] for row in rows}
    # The seed has 7 templates; assert at least the headline 3.
    assert "weekly-groceries" in slugs
    assert "bbq-party" in slugs
    assert "keto-basics" in slugs
    # Each summary has item_count > 0
    for row in rows:
        assert row["item_count"] > 0


def test_list_templates_filter_by_category(client, test_user):
    r = client.get("/templates?category=party")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["slug"] == "bbq-party"
    assert rows[0]["category"] == "party"


def test_list_templates_search(client, test_user):
    r = client.get("/templates?search=pizza")
    assert r.status_code == 200
    rows = r.json()
    assert any(row["slug"] == "pizza-night" for row in rows)


def test_list_templates_search_blank_is_no_filter(client, test_user):
    r = client.get("/templates?search=")
    assert r.status_code == 200
    rows = r.json()
    # All seeded templates returned
    seeded = {t["slug"] for t in list_template_dicts()}
    assert seeded.issubset({row["slug"] for row in rows})


def test_list_templates_excludes_inactive(client, test_user):
    """Mark a template inactive and verify it disappears from the list."""
    with _Session() as db:
        t = db.query(ListTemplate).filter(ListTemplate.slug == "keto-basics").first()
        t.is_active = False
        db.commit()
    r = client.get("/templates")
    assert r.status_code == 200
    slugs = {row["slug"] for row in r.json()}
    assert "keto-basics" not in slugs


def test_template_categories(client, test_user):
    r = client.get("/templates/categories")
    assert r.status_code == 200
    cats = r.json()
    assert "meal" in cats
    assert "party" in cats
    assert "diet" in cats
    # Sorted, distinct
    assert cats == sorted(set(cats))


# ----- Detail -----

def test_get_template_detail(client, test_user):
    r = client.get("/templates/weekly-groceries")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["slug"] == "weekly-groceries"
    assert body["name"] == "Weekly Groceries"
    assert body["item_count"] == len(body["items"])
    assert body["item_count"] >= 10
    # Items are ordered by sort_index; check sort_index is non-decreasing.
    sort_idx = [i["sort_index"] for i in body["items"]]
    assert sort_idx == sorted(sort_idx)
    # First item should be Milk (sort_index=0 in the seed)
    assert body["items"][0]["name"] == "Milk"


def test_get_template_detail_unknown(client, test_user):
    r = client.get("/templates/does-not-exist")
    assert r.status_code == 404


def test_get_template_detail_inactive(client, test_user):
    with _Session() as db:
        t = db.query(ListTemplate).filter(ListTemplate.slug == "bbq-party").first()
        t.is_active = False
        db.commit()
    r = client.get("/templates/bbq-party")
    assert r.status_code == 404


# ----- Clone -----

def test_clone_creates_new_list(client, test_user):
    r = client.post("/templates/weekly-groceries/clone", json={})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created_list"] is True
    assert body["list_name"] == "Weekly Groceries"
    assert body["added"] >= 10
    assert body["skipped"] == []
    # Verify list + items actually exist
    with _Session() as db:
        gl = db.get(GroceryList, body["list_id"])
        assert gl is not None
        assert gl.owner_id == test_user.id
        items = db.query(ListItem).filter(ListItem.list_id == gl.id).all()
        assert len(items) == body["added"]


def test_clone_with_custom_list_name(client, test_user):
    r = client.post(
        "/templates/keto-basics/clone",
        json={"list_name": "My Keto Week"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["created_list"] is True
    assert body["list_name"] == "My Keto Week"
    assert body["added"] >= 10


def test_clone_to_existing_list(client, test_user):
    lid = _create_list(test_user.id, "My Existing List")
    r = client.post(
        "/templates/breakfast-essentials/clone",
        json={"list_id": lid},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["created_list"] is False
    assert body["list_id"] == lid
    assert body["list_name"] == "My Existing List"
    assert body["added"] >= 10
    # Existing list now has the items
    with _Session() as db:
        items = db.query(ListItem).filter(ListItem.list_id == lid).all()
        assert len(items) == body["added"]


def test_clone_auto_categorizes(client, test_user):
    """Template items have a category, but verify it round-trips through to
    the cloned ListItem."""
    r = client.post("/templates/pizza-night/clone", json={})
    assert r.status_code == 201
    with _Session() as db:
        items = db.query(ListItem).filter(ListItem.name == "Mozzarella").all()
        assert len(items) == 1
        assert items[0].category and items[0].category.startswith("dairy")


def test_clone_unknown_template(client, test_user):
    r = client.post("/templates/no-such-template/clone", json={})
    assert r.status_code == 404


def test_clone_unknown_list_id(client, test_user):
    r = client.post(
        "/templates/weekly-groceries/clone",
        json={"list_id": 9999},
    )
    assert r.status_code == 404


def test_clone_no_edit_rights(client, test_user):
    """Caller is a viewer on someone else's list -> 403."""
    bid = _create_other_user_with_viewer_share(test_user.id)
    r = client.post(
        "/templates/weekly-groceries/clone",
        json={"list_id": bid},
    )
    assert r.status_code == 403


def test_clone_inactive_template(client, test_user):
    with _Session() as db:
        t = db.query(ListTemplate).filter(ListTemplate.slug == "new-home-pantry").first()
        t.is_active = False
        db.commit()
    r = client.post("/templates/new-home-pantry/clone", json={})
    assert r.status_code == 404


def test_clone_blank_name_uses_template_name(client, test_user):
    r = client.post(
        "/templates/pizza-night/clone",
        json={"list_name": "   "},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["list_name"] == "Pizza Night"


def test_clone_blank_item_skipped(client, test_user):
    """If a template item has a blank/whitespace name, it should be
    reported in `skipped` and NOT create a ListItem.
    """
    with _Session() as db:
        t = db.query(ListTemplate).filter(ListTemplate.slug == "weekly-groceries").first()
        # Append a blank item to the end of the items list
        db.add(ListTemplateItem(template_id=t.id, name="   ", category="misc", sort_index=9999))
        db.commit()
    r = client.post("/templates/weekly-groceries/clone", json={})
    assert r.status_code == 201
    body = r.json()
    assert "   " in body["skipped"]
    # Sanity: real items still added
    assert body["added"] >= 10
