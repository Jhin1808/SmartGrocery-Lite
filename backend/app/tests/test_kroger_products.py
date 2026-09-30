from unittest.mock import AsyncMock, patch
import pytest
from app.catalog.kroger_client import _normalize_product, get_product
from app.catalog.taxonomy import get_cached_taxonomy

PRODUCT = {"productId": "0001111010831", "description": "Whole milk", "items": [{"price": {"regular": 5.49, "promo": 4.99}, "inventory": {"stockLevel": "HIGH"}, "fulfillment": {"curbside": True}}]}

def test_kroger_variant_prices_and_inventory():
    result = _normalize_product(PRODUCT, get_cached_taxonomy(), "70300724")
    assert result["price_regular"] == 5.49
    assert result["price_promo"] == 4.99
    assert result["stock_level"] == "HIGH"
    assert result["fulfillment"] == {"curbside": True}

@pytest.mark.asyncio
async def test_product_detail_accepts_single_object():
    with patch("app.catalog.kroger_client.kroger_configured", return_value=True), patch("app.catalog.kroger_client._authed_get", AsyncMock(return_value={"data": PRODUCT})):
        result = await get_product(None, "0001111010831", "70300724")
    assert result["name"] == "Whole milk"
    assert result["price_regular"] == 5.49


def test_store_products_survive_a_full_generic_search_page(client, test_user):
    from app.models import ConnectedStore
    from app.tests.conftest import TestingSessionLocal
    with TestingSessionLocal() as db:
        db.add(ConnectedStore(user_id=test_user.id, source="kroger", chain="RALPHS", location_id="70300724", name="Test store"))
        db.commit()
    generic = [{"source": "off", "code": str(i), "name": "Generic milk"} for i in range(5)]
    store = [{"source": "kroger", "code": "0", "name": "Store milk", "price_regular": 5.49}]
    with patch("app.routers.catalog.kroger_configured", return_value=True), patch("app.routers.catalog._cache_get", return_value=None), patch("app.routers.catalog._cache_put"), patch("app.catalog.off_client.search", AsyncMock(return_value=generic)), patch("app.catalog.kroger_client.search_products", AsyncMock(return_value=store)):
        r = client.get("/catalog/search?q=milk&page_size=5")
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 5
    assert results[0]["source"] == "kroger"
    assert results[0]["price_regular"] == 5.49
    assert len([p for p in results if p["code"] == "0"]) == 1
