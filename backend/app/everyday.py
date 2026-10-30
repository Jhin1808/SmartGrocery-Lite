"""Shared normalization and purchase recording, inside the caller's transaction."""
from datetime import datetime, timezone
from app.models import PurchaseHistory


def name_key(name):
    return " ".join(name.split()).casefold()


def record_purchase(db, user_id, item):
    table = PurchaseHistory.__table__
    values = dict(user_id=user_id, name=item.name, name_key=name_key(item.name),
                  quantity=item.quantity, last_purchased_at=datetime.now(timezone.utc))
    if db.get_bind().dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    statement = insert(table).values(**values)
    db.execute(statement.on_conflict_do_update(
        index_elements=[table.c.user_id, table.c.name_key],
        set_={key: values[key] for key in ("name", "quantity", "last_purchased_at")},
    ))
