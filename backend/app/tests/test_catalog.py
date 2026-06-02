"""Tests for /catalog/* and /stores/* (OFF + Kroger are mocked)."""
import pytest
from unittest.mock import AsyncMock, patch


# --- Categories ---

def test_catalog_categories_returns_tree(client, test_user):
    r = client.get("/catalog/categories")
    assert r.status_code == 200, r.text
    nodes = r.json()
    assert isinstance(nodes, list) and len(nodes) > 0
    # Find "Dairy" top-level
    dairy = next((n for n in nodes if n.get("canonical") == "dairy"), None)
    assert dairy is not None
    # It has a child for milk
    milk = next((c for c in dairy.get("children", []) if c.get("canonical") == "dairy.milk"), None)
    assert milk is not None


# --- Search (OFF mocked) ---

@pytest.mark.asyncio
async def test_catalog_search_returns_off_results(client, test_user):
    fake = [
        {
            "source": "off", "code": "0123456", "name": "Horizon 2% Milk",
            "brand": "Horizon", "image_url": None, "categories": ["en:milks"],
            "canonical": "dairy.milk", "display": "Dairy > Milk",
            "weight_value": None, "weight_unit": None,
            "price_regular": None, "price_promo": None,
            "aisle": None, "stock_level": None, "fulfillment": None,
        }
    ]
    with patch("app.routers.catalog.off_client.search", new=AsyncMock(return_value=fake)):
        r = client.get("/catalog/search", params={"q": "milk"})
        assert r.status_code == 200, r.text
        out = r.json()
        assert len(out) == 1
        assert out[0]["name"] == "Horizon 2% Milk"
        assert out[0]["canonical"] == "dairy.milk"


def test_catalog_search_empty_query_returns_empty(client, test_user):
    r = client.get("/catalog/search", params={"q": ""})
    assert r.status_code == 200
    assert r.json() == []


# --- Barcode (OFF + Kroger fallback) ---

@pytest.mark.asyncio
async def test_catalog_barcode_off_hit(client, test_user):
    fake = {
        "source": "off", "code": "0123456", "name": "Coca-Cola",
        "brand": "Coca-Cola", "image_url": None, "categories": ["en:sodas"],
        "canonical": "beverages.soda", "display": "Beverages > Soda",
        "weight_value": 355, "weight_unit": "ml",
        "price_regular": None, "price_promo": None,
        "aisle": None, "stock_level": None, "fulfillment": None,
    }
    with patch("app.routers.catalog.off_client.barcode", new=AsyncMock(return_value=fake)):
        r = client.get("/catalog/barcode/012345678905")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "Coca-Cola"


def test_catalog_barcode_invalid(client, test_user):
    r = client.get("/catalog/barcode/abc")
    assert r.status_code == 400


# --- Kroger status (no creds) ---

def test_kroger_status_when_not_configured(client, test_user, monkeypatch):
    from app import config as app_config
    monkeypatch.setattr(app_config, "KROGER_CLIENT_ID", "")
    monkeypatch.setattr(app_config, "KROGER_CLIENT_SECRET", "")
    monkeypatch.setattr(app_config, "kroger_configured", lambda: False)
    r = client.get("/auth/kroger/status")
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is False
    assert body["connected_store"] is None


# --- Stores connect/disconnect ---

def test_stores_connect_disconnect(client, test_user, monkeypatch):
    from app import config as app_config
    monkeypatch.setattr(app_config, "kroger_configured", lambda: True)

    payload = {"chain": "Kroger", "location_id": "01400943", "name": "Kroger #943", "address": "123 Main St"}
    r = client.post("/stores/connect", json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["chain"] == "Kroger"
    assert body["location_id"] == "01400943"

    r = client.get("/stores/connected")
    assert r.status_code == 200
    assert r.json()["location_id"] == "01400943"

    r = client.delete("/stores/connected")
    assert r.status_code == 204

    r = client.get("/stores/connected")
    assert r.status_code == 200
    assert r.json() is None
