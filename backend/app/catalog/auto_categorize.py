# backend/app/catalog/auto_categorize.py
"""Best-effort auto-categorization for plain-text item names.

Order:
  1. Direct OFF slug match against a curated subset of categories whose
     keywords appear in the name.
  2. `rapidfuzz` partial ratio (>= 88) against canonical + display names.
  3. Curated synonym map.
  4. None.

If the name is empty, returns (None, None).
"""
from __future__ import annotations

import re
from typing import Optional

from .taxonomy import Taxonomy, get_cached_taxonomy


# Synonyms (lowercased) -> canonical leaf path
_LEAF_HINTS: list[tuple[set[str], str]] = [
    ({"milk"},                       "dairy.milk"),
    ({"almond milk", "oat milk", "soy milk", "coconut milk", "cashew milk", "rice milk", "dairy-free milk", "plant milk", "plant-based milk", "non-dairy milk"}, "dairy.milk.dairy-free"),
    ({"egg", "eggs"},                "eggs"),
    ({"bread", "baguette", "roll", "bun", "loaf"}, "bakery.bread"),
    ({"pasta", "spaghetti", "penne", "rigatoni", "linguine", "fettuccine", "macaroni"}, "pantry.pasta"),
    ({"rice"},                       "pantry.rice"),
    ({"noodle", "ramen", "udon", "soba"}, "pantry.noodles"),
    ({"flour"},                      "pantry.flour"),
    ({"sugar"},                      "pantry.sugar"),
    ({"oil", "olive oil", "vegetable oil", "canola oil"}, "pantry.oil"),
    ({"salt"},                       "condiments.salt"),
    ({"pepper"},                     "condiments.spice"),
    ({"sauce", "ketchup", "mustard", "mayo", "mayonnaise"}, "condiments.sauce"),
    ({"vinegar"},                    "condiments.vinegar"),
    ({"beef", "steak", "ground beef", "brisket", "roast beef"}, "meat.beef"),
    ({"chicken", "poultry"},         "meat.chicken"),
    ({"pork", "bacon", "ham", "sausage", "pork chop"}, "meat.pork"),
    ({"turkey"},                     "meat.turkey"),
    ({"fish", "salmon", "tuna", "cod", "tilapia", "trout", "halibut"}, "seafood.fish"),
    ({"shrimp", "prawn"},            "seafood.shrimp"),
    ({"apple", "banana", "orange", "berry", "strawberry", "blueberry", "raspberry", "grape", "lemon", "lime", "mango", "peach", "pear", "pineapple", "watermelon", "melon", "cherry", "plum"}, "produce.fruit"),
    ({"lettuce", "spinach", "kale", "arugula", "cabbage", "broccoli", "cauliflower", "carrot", "celery", "cucumber", "onion", "garlic", "pepper", "tomato", "potato", "zucchini", "mushroom", "corn", "pea", "asparagus"}, "produce.vegetable"),
    ({"water", "sparkling water", "mineral water"}, "beverages.water"),
    ({"soda", "pop", "cola"},        "beverages.soda"),
    ({"juice"},                      "beverages.juice"),
    ({"coffee"},                     "beverages.coffee"),
    ({"tea"},                        "beverages.tea"),
    ({"chips", "crisps", "tortilla chips", "potato chips"}, "snacks.chips"),
    ({"cookie", "biscuit"},          "snacks.cookies"),
    ({"chocolate"},                  "snacks.chocolate"),
    ({"candy"},                      "snacks.candy"),
    ({"cheese", "cheddar", "mozzarella", "parmesan", "feta", "brie", "gouda", "swiss"}, "dairy.cheese"),
    ({"yogurt", "yoghurt"},          "dairy.yogurt"),
    ({"butter"},                     "dairy.butter"),
    ({"cream"},                      "dairy.cream"),
]


_SUBCATEGORY_KEYWORDS: list[tuple[set[str], str]] = [
    ({"fat-free", "fat free", "nonfat", "non-fat", "0%"}, "fat-free"),
    ({"2%", "reduced fat", "reduced-fat"}, "fat-reduced"),
    ({"1%", "low fat", "low-fat"}, "low-fat"),
    ({"whole", "full fat", "full-fat"}, "whole"),
    ({"skim", "skimmed"}, "fat-free"),
    ({"lactose-free", "lactose free"}, "lactose-free"),
    ({"dairy-free", "dairy free", "plant-based", "plant based", "non-dairy", "non dairy"}, "dairy-free"),
    ({"organic"}, "organic"),
    ({"gluten-free", "gluten free"}, "gluten-free"),
]


def _normalize(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9% \-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def categorize(name: str, taxonomy: Optional[Taxonomy] = None) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Return (canonical_path, display, subcategory) or (None, None, None).

    `subcategory` is independent of canonical and is inferred from
    keywords (fat-free, dairy-free, etc.).
    """
    if not name:
        return None, None, None
    if taxonomy is None:
        taxonomy = get_cached_taxonomy()

    norm = _normalize(name)

    # 1. Synonym map from bundled taxonomy (e.g. "2%" -> "fat-reduced")
    tokens = [t for t in re.split(r"[\s\-]+", norm) if t]

    # 2. Leaf hint lookup. Check sets in REVERSE order so the more specific
    # multi-word sets (e.g. {"oat milk", "almond milk", ...}) win over the
    # single-word set ({"milk"}).
    canonical: Optional[str] = None
    for keys, leaf in reversed(_LEAF_HINTS):
        for k in keys:
            if k in norm:
                canonical = leaf
                break
        if canonical:
            break

    # 3. Subcategory detection
    subcategory: Optional[str] = None
    for keys, label in _SUBCATEGORY_KEYWORDS:
        for k in keys:
            if k in norm:
                subcategory = label
                break
        if subcategory:
            break

    # 4. Fuzzy match against taxonomy canonical/display names (optional, soft)
    if not canonical:
        try:
            from rapidfuzz import process, fuzz
            choices: dict[str, str] = {}
            for e in taxonomy.entries:
                choices[e["display"].lower()] = e["canonical"]
                choices[e["canonical"]] = e["canonical"]
            hit = process.extractOne(norm, list(choices.keys()), scorer=fuzz.partial_ratio)
            if hit and hit[1] >= 88:
                canonical = choices[hit[0]]
        except Exception:
            pass

    if not canonical:
        return None, None, subcategory

    display = (taxonomy.by_canonical.get(canonical) or {}).get("display")
    return canonical, display, subcategory
