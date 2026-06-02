"""Tests for offline auto-categorization (no DB, no network)."""
from app.catalog.auto_categorize import categorize
from app.catalog.taxonomy import get_cached_taxonomy


def test_categorize_milk_default():
    c, d, s = categorize("milk")
    assert c == "dairy.milk"
    assert d is not None
    assert s is None


def test_categorize_2pct_subcategory():
    c, d, s = categorize("Horizon 2% Milk")
    assert c in ("dairy.milk", "dairy.milk.2pct")
    assert s == "fat-reduced"


def test_categorize_fat_free_explicit():
    c, d, s = categorize("Fat Free Milk")
    assert c == "dairy.milk"
    assert s == "fat-free"


def test_categorize_plant_milk():
    c, d, s = categorize("Oat Milk")
    assert c == "dairy.milk.dairy-free"


def test_categorize_eggs():
    c, d, s = categorize("Organic Eggs")
    assert c == "eggs"
    # "organic" is in our subcategory map
    assert s == "organic"


def test_categorize_apple_fruit():
    c, d, s = categorize("Granny Smith Apple")
    assert c == "produce.fruit"


def test_categorize_chicken_meat():
    c, d, s = categorize("Boneless Chicken Breast")
    assert c == "meat.chicken"


def test_categorize_unknown_returns_none_category():
    c, d, s = categorize("xqzq123notfood")
    assert c is None
    assert d is None


def test_categorize_empty_returns_none():
    c, d, s = categorize("")
    assert c is None and d is None and s is None


def test_taxonomy_loaded_with_minimum_entries():
    tax = get_cached_taxonomy()
    assert len(tax.entries) > 30, "taxonomy should ship with the common categories"
    # Sanity: top-level buckets are present
    assert any(e["canonical"] == "dairy" for e in tax.entries)
    assert any(e["canonical"] == "produce" for e in tax.entries)
