"""Idempotent seed of curated list templates (M5).

Called from ``main.py``'s lifespan so the templates are always available
to ``/templates`` without needing a separate CLI run.
"""
from __future__ import annotations

import logging
from typing import Iterable

from sqlalchemy.orm import Session

from app.models import ListTemplate, ListTemplateItem

log = logging.getLogger(__name__)


# Curated starter lists. Categories are coarse labels used for the FE
# filter chips. Quantities are sensible defaults; clone doesn't enforce
# them — they're a starting point for the user.
_TEMPLATES: list[dict] = [
    {
        "slug": "weekly-groceries",
        "name": "Weekly Groceries",
        "description": "A balanced weekly shop covering breakfast, lunch, dinner, and snacks.",
        "category": "meal",
        "emoji": "🛒",
        "sort_index": 10,
        "items": [
            ("Milk", "dairy.milk", 1),
            ("Eggs", "eggs", 1),
            ("Bread", "bakery.bread", 1),
            ("Butter", "dairy.butter", 1),
            ("Chicken breast", "meat.chicken", 2),
            ("Ground beef", "meat.beef", 1),
            ("Rice", "pantry.rice", 1),
            ("Pasta", "pantry.pasta", 2),
            ("Tomato sauce", "pantry.sauce", 2),
            ("Cheese", "dairy.cheese", 1),
            ("Bananas", "produce.fruit", 6),
            ("Apples", "produce.fruit", 4),
            ("Lettuce", "produce.vegetable", 1),
            ("Tomatoes", "produce.vegetable", 4),
            ("Onions", "produce.vegetable", 3),
            ("Potatoes", "produce.vegetable", 5),
            ("Olive oil", "pantry.oil", 1),
            ("Coffee", "beverages.coffee", 1),
        ],
    },
    {
        "slug": "breakfast-essentials",
        "name": "Breakfast Essentials",
        "description": "Pantry staples for an easy weekday breakfast — eggs, oats, coffee, and spreads.",
        "category": "meal",
        "emoji": "🥞",
        "sort_index": 20,
        "items": [
            ("Eggs", "eggs", 1),
            ("Milk", "dairy.milk", 1),
            ("Bread", "bakery.bread", 1),
            ("Butter", "dairy.butter", 1),
            ("Oats", "pantry.cereal", 1),
            ("Coffee", "beverages.coffee", 1),
            ("Orange juice", "beverages.juice", 1),
            ("Yogurt", "dairy.yogurt", 4),
            ("Cereal", "pantry.cereal", 1),
            ("Peanut butter", "pantry.spread", 1),
            ("Strawberries", "produce.fruit", 1),
            ("Bananas", "produce.fruit", 4),
        ],
    },
    {
        "slug": "bbq-party",
        "name": "BBQ Party",
        "description": "Everything you need to host a backyard cookout for 6-8 friends.",
        "category": "party",
        "emoji": "🍔",
        "sort_index": 30,
        "items": [
            ("Ground beef", "meat.beef", 2),
            ("Hamburger buns", "bakery.bread", 2),
            ("Hot dogs", "meat.pork", 1),
            ("Hot dog buns", "bakery.bread", 1),
            ("Chicken breast", "meat.chicken", 2),
            ("Lettuce", "produce.vegetable", 1),
            ("Tomatoes", "produce.vegetable", 4),
            ("Onions", "produce.vegetable", 2),
            ("Cheese", "dairy.cheese", 1),
            ("Ketchup", "condiments.sauce", 1),
            ("Mustard", "condiments.sauce", 1),
            ("Mayonnaise", "condiments.sauce", 1),
            ("Chips", "snacks.chips", 3),
            ("Soda", "beverages.soda", 2),
            ("Ice cream", "frozen.dessert", 1),
        ],
    },
    {
        "slug": "pizza-night",
        "name": "Pizza Night",
        "description": "Build your own pizza — dough, sauce, cheese, and classic toppings.",
        "category": "meal",
        "emoji": "🍕",
        "sort_index": 40,
        "items": [
            ("Pizza dough", "bakery.dough", 1),
            ("Mozzarella", "dairy.cheese", 1),
            ("Tomato sauce", "pantry.sauce", 1),
            ("Pepperoni", "meat.pork", 1),
            ("Bell peppers", "produce.vegetable", 2),
            ("Mushrooms", "produce.vegetable", 1),
            ("Black olives", "pantry.canned", 1),
            ("Parmesan", "dairy.cheese", 1),
            ("Olive oil", "pantry.oil", 1),
            ("Garlic", "produce.vegetable", 1),
        ],
    },
    {
        "slug": "new-home-pantry",
        "name": "New Home Pantry",
        "description": "A foundation pantry for a new kitchen — oils, baking basics, canned goods, and coffee.",
        "category": "household",
        "emoji": "🏠",
        "sort_index": 50,
        "items": [
            ("Salt", "condiments.salt", 1),
            ("Pepper", "condiments.spice", 1),
            ("Olive oil", "pantry.oil", 1),
            ("Vegetable oil", "pantry.oil", 1),
            ("Flour", "pantry.flour", 1),
            ("Sugar", "pantry.sugar", 1),
            ("Rice", "pantry.rice", 1),
            ("Pasta", "pantry.pasta", 2),
            ("Canned tomatoes", "pantry.canned", 2),
            ("Chicken stock", "pantry.canned", 2),
            ("Coffee", "beverages.coffee", 1),
            ("Tea", "beverages.tea", 1),
            ("Honey", "pantry.sweetener", 1),
            ("Soy sauce", "condiments.sauce", 1),
            ("Vinegar", "condiments.vinegar", 1),
            ("Cereal", "pantry.cereal", 1),
            ("Peanut butter", "pantry.spread", 1),
        ],
    },
    {
        "slug": "healthy-salad-bowl",
        "name": "Healthy Salad Bowl",
        "description": "Fresh produce and proteins for build-your-own salad bowls all week.",
        "category": "diet",
        "emoji": "🥗",
        "sort_index": 60,
        "items": [
            ("Mixed greens", "produce.vegetable", 1),
            ("Cherry tomatoes", "produce.vegetable", 1),
            ("Cucumber", "produce.vegetable", 1),
            ("Bell peppers", "produce.vegetable", 2),
            ("Carrots", "produce.vegetable", 1),
            ("Avocado", "produce.fruit", 3),
            ("Feta cheese", "dairy.cheese", 1),
            ("Chickpeas", "pantry.canned", 1),
            ("Olive oil", "pantry.oil", 1),
            ("Lemon", "produce.fruit", 2),
            ("Almonds", "pantry.nuts", 1),
            ("Chicken breast", "meat.chicken", 2),
        ],
    },
    {
        "slug": "keto-basics",
        "name": "Keto Basics",
        "description": "Low-carb staples — meats, healthy fats, eggs, and low-sugar vegetables.",
        "category": "diet",
        "emoji": "🥑",
        "sort_index": 70,
        "items": [
            ("Eggs", "eggs", 2),
            ("Butter", "dairy.butter", 1),
            ("Heavy cream", "dairy.cream", 1),
            ("Cheese", "dairy.cheese", 1),
            ("Chicken breast", "meat.chicken", 2),
            ("Ground beef", "meat.beef", 1),
            ("Bacon", "meat.pork", 1),
            ("Salmon", "seafood.fish", 1),
            ("Avocado", "produce.fruit", 3),
            ("Spinach", "produce.vegetable", 1),
            ("Broccoli", "produce.vegetable", 1),
            ("Cauliflower", "produce.vegetable", 1),
            ("Almonds", "pantry.nuts", 1),
            ("Olive oil", "pantry.oil", 1),
        ],
    },
]


def _existing_slugs(db: Session) -> set[str]:
    return {row[0] for row in db.query(ListTemplate.slug).all()}


def ensure_templates_in_db(db: Session) -> int:
    """Insert any missing curated templates. Returns the number of new
    templates created (0 on subsequent runs)."""
    existing = _existing_slugs(db)
    created = 0
    for tpl in _TEMPLATES:
        if tpl["slug"] in existing:
            continue
        row = ListTemplate(
            slug=tpl["slug"],
            name=tpl["name"],
            description=tpl["description"],
            category=tpl["category"],
            emoji=tpl["emoji"],
            sort_index=tpl["sort_index"],
            is_active=True,
        )
        row.items = [
            ListTemplateItem(
                name=name,
                category=category,
                quantity=qty,
                sort_index=i,
            )
            for i, (name, category, qty) in enumerate(tpl["items"])
        ]
        db.add(row)
        created += 1
    if created:
        try:
            db.commit()
            log.info("Seeded %d list templates", created)
        except Exception as e:
            log.exception("Failed to seed list templates: %s", e)
            db.rollback()
            return 0
    return created


def list_template_dicts() -> Iterable[dict]:
    """Expose the seed definitions (used by tests to assert the canonical
    catalog of templates is what we expect)."""
    return _TEMPLATES
