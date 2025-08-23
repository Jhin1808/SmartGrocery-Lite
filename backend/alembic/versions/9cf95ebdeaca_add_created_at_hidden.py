"""add created_at + hidden

Revision ID: 9cf95ebdeaca
Revises: c8295c653d6d
Create Date: 2025-08-22 21:21:31.858952

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9cf95ebdeaca'
down_revision: Union[str, Sequence[str], None] = 'c8295c653d6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Backfill any existing NULLs just in case
    op.execute("UPDATE grocery_list SET created_at = now() WHERE created_at IS NULL")
    # Ensure the column now has a default at the DB level
    op.alter_column(
        "grocery_list",
        "created_at",
        server_default=sa.text("now()"),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )

def downgrade():
    op.alter_column(
        "grocery_list",
        "created_at",
        server_default=None,
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
