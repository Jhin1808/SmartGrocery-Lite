# backend/app/catalog/taxonomy.py
"""Loads the bundled OFF taxonomy mirror and exposes lookup helpers.

The taxonomy is stored as a JSON file at app/catalog/data/taxonomy.json.
At process start, `load_taxonomy()` is called once and its result is cached
on `app.state.taxonomy`. This keeps lookups fully offline and O(1).
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Optional

from sqlalchemy.orm import Session

from app.models import TaxonomyEntry


DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "taxonomy.json")


class Taxonomy:
    """In-memory taxonomy view.

    - `by_slug`: slug -> entry
    - `by_canonical`: canonical -> entry
    - `entries`: list of all entries
    - `synonyms`: dict[str, str] of normalized phrase -> token
    """

    def __init__(self, entries: list[dict], synonyms: dict[str, str], top_levels: list[dict]):
        self.entries: list[dict] = entries
        self.synonyms: dict[str, str] = {k.lower(): v.lower() for k, v in (synonyms or {}).items()}
        self.top_levels: list[dict] = top_levels or []
        self.by_slug: dict[str, dict] = {e["slug"]: e for e in entries}
        self.by_canonical: dict[str, dict] = {e["canonical"]: e for e in entries}
        # Build a slug->children index for tree building
        self.children_by_parent: dict[Optional[str], list[dict]] = {}
        for e in entries:
            self.children_by_parent.setdefault(e.get("parent_slug"), []).append(e)
        # Top-level buckets by canonical
        self.top_level_by_canonical: dict[str, str] = {}
        for tl in top_levels:
            self.top_level_by_canonical[tl["canonical"]] = tl.get("top_level") or tl["canonical"]

    def map_off_categories(self, off_tags: list[str]) -> Optional[dict]:
        """Pick the most specific OFF tag and return its mapped entry.

        OFF often returns dozens of tags; we prefer the longest slug match
        (most specific) so 'en:fat-free-milks' wins over 'en:milks' wins over
        'en:dairies'.
        """
        if not off_tags:
            return None
        # normalize: keep only slugs we have
        candidates = [t for t in off_tags if t in self.by_slug]
        if not candidates:
            return None
        candidates.sort(key=lambda s: (-s.count("-"), -len(s)))
        return self.by_slug[candidates[0]]

    def tree(self) -> list[dict]:
        """Return top-level nodes with nested children, for the /catalog/categories endpoint."""
        # Top-level entries are those without a parent_slug
        def build(entry: dict) -> dict:
            kids = self.children_by_parent.get(entry["slug"], [])
            return {
                "slug": entry["slug"],
                "canonical": entry["canonical"],
                "display": entry["display"],
                "top_level": entry.get("top_level"),
                "children": [build(k) for k in kids],
            }

        tops = [e for e in self.entries if not e.get("parent_slug")]
        return [build(t) for t in tops]


def load_taxonomy_from_file(path: str = DATA_PATH) -> Taxonomy:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return Taxonomy(
        entries=raw.get("entries", []),
        synonyms=raw.get("synonyms", {}),
        top_levels=raw.get("top_levels", []),
    )


def ensure_taxonomy_in_db(db: Session, taxonomy: Taxonomy) -> None:
    """Upsert bundled taxonomy into the DB. Idempotent.

    Tests + first-boot on production run this once so the data is queryable.
    """
    existing = {row.slug: row for row in db.query(TaxonomyEntry).all()}
    seen_slugs: set[str] = set()
    for e in taxonomy.entries:
        seen_slugs.add(e["slug"])
        row = existing.get(e["slug"])
        if row is None:
            row = TaxonomyEntry(
                slug=e["slug"],
                canonical=e["canonical"],
                display=e["display"],
                parent_slug=e.get("parent_slug"),
                top_level=e.get("top_level"),
            )
            db.add(row)
        else:
            row.canonical = e["canonical"]
            row.display = e["display"]
            row.parent_slug = e.get("parent_slug")
            row.top_level = e.get("top_level")
    # Remove rows that are no longer in the bundled file
    for slug, row in existing.items():
        if slug not in seen_slugs:
            db.delete(row)
    db.commit()


def get_cached_taxonomy() -> Taxonomy:
    """Returns a process-singleton Taxonomy instance."""
    global _TAX
    if _TAX is None:
        _TAX = load_taxonomy_from_file()
    return _TAX


_TAX: Optional[Taxonomy] = None
