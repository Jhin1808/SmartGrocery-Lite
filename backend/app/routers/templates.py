"""List Templates router (M5).

Curated starter lists. Users browse, preview, and clone them into a new
or existing list. Auto-categorization fills in any missing category on
the cloned ``ListItem`` rows.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user_any as get_current_user
from app.models import GroceryList, ListItem, ListTemplate, ListTemplateItem, User
from app.catalog.auto_categorize import categorize as auto_categorize
from app.permissions import can_write
from app.schemas import (
    TemplateCloneRequest,
    TemplateCloneResponse,
    TemplateDetailRead,
    TemplateItemRead,
    TemplateSummaryRead,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/templates", tags=["templates"])


def _summarize(t: ListTemplate) -> TemplateSummaryRead:
    return TemplateSummaryRead(
        id=t.id,
        slug=t.slug,
        name=t.name,
        description=t.description or "",
        category=t.category,
        emoji=t.emoji,
        sort_index=t.sort_index,
        item_count=len(t.items or []),
    )


def _get_active_template_or_404(db: Session, slug: str) -> ListTemplate:
    t = db.execute(
        select(ListTemplate)
        .where(ListTemplate.slug == slug, ListTemplate.is_active.is_(True))
        .options(selectinload(ListTemplate.items))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.get("", response_model=list[TemplateSummaryRead])
def list_templates(
    category: Optional[str] = Query(None, max_length=40, description="Filter by top-level category"),
    search: Optional[str] = Query(None, max_length=80, description="Case-insensitive search over name + description"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """List all active curated templates, optionally filtered."""
    q = select(ListTemplate).where(ListTemplate.is_active.is_(True)).options(
        selectinload(ListTemplate.items)
    )
    if category:
        q = q.where(ListTemplate.category == category)
    if search:
        s = f"%{search.strip()}%"
        if s == "%%":
            # empty after strip -> return everything
            pass
        else:
            q = q.where(or_(ListTemplate.name.ilike(s), ListTemplate.description.ilike(s)))
    rows = db.execute(q).scalars().all()
    # Order by sort_index then name for stable display.
    rows.sort(key=lambda r: (r.sort_index, r.name.lower()))
    return [_summarize(t) for t in rows]


@router.get("/categories", response_model=list[str])
def list_template_categories(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Distinct top-level categories currently in use by active templates."""
    rows = db.execute(
        select(ListTemplate.category)
        .where(ListTemplate.is_active.is_(True), ListTemplate.category.isnot(None))
        .distinct()
    ).scalars().all()
    # Stable, sorted output.
    return sorted({c for c in rows if c})


@router.get("/{slug}", response_model=TemplateDetailRead)
def get_template(
    slug: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    t = _get_active_template_or_404(db, slug)
    items = sorted(t.items, key=lambda i: (i.sort_index, i.id))
    return TemplateDetailRead(
        id=t.id,
        slug=t.slug,
        name=t.name,
        description=t.description or "",
        category=t.category,
        emoji=t.emoji,
        sort_index=t.sort_index,
        item_count=len(items),
        items=[TemplateItemRead.model_validate(i) for i in items],
    )


@router.post(
    "/{slug}/clone",
    response_model=TemplateCloneResponse,
    status_code=status.HTTP_201_CREATED,
)
def clone_template(
    slug: str,
    payload: TemplateCloneRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clone a template's items into a new or existing list owned by the
    caller (or one the caller can edit).

    Body:
        ``{ "list_id": <int> }`` — append to an existing list
        ``{ "list_name": "<str>" }`` — create a new list with this name
        ``{}`` — create a new list named after the template
    """
    tpl = _get_active_template_or_404(db, slug)

    created_list = False
    if payload.list_id is not None:
        gl = db.get(GroceryList, payload.list_id)
        if gl is None:
            raise HTTPException(status_code=404, detail="List not found")
        if not can_write(db, current_user.id, gl.id):
            raise HTTPException(status_code=403, detail="You don't have edit access to this list")
    else:
        # Create a new list, named after the template (or caller's choice)
        new_name = (payload.list_name or tpl.name).strip() or tpl.name
        if len(new_name) > 100:
            new_name = new_name[:100]
        gl = GroceryList(name=new_name, owner_id=current_user.id)
        db.add(gl)
        db.flush()  # populate gl.id
        created_list = True

    added = 0
    skipped: list[str] = []
    for it in sorted(tpl.items, key=lambda x: (x.sort_index, x.id)):
        original_name = (it.name or "")
        name = original_name.strip()
        if not name:
            skipped.append(original_name)
            continue
        if len(name) > 100:
            name = name[:100]
        qty = max(1, int(it.quantity or 1))
        canonical = (it.category or "").strip() or None
        subcategory: Optional[str] = None
        if not canonical:
            canonical, _display, subcategory = auto_categorize(name)
        item = ListItem(
            name=name,
            quantity=qty,
            list_id=gl.id,
            category=canonical,
            subcategory=subcategory,
        )
        db.add(item)
        added += 1

    try:
        db.commit()
        db.refresh(gl)
    except Exception as e:
        log.exception("template clone commit failed: %s", e)
        db.rollback()
        raise HTTPException(status_code=500, detail="Couldn't clone template")

    return TemplateCloneResponse(
        list_id=gl.id,
        list_name=gl.name,
        created_list=created_list,
        added=added,
        skipped=skipped,
    )
