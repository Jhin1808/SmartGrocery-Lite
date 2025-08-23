"""fix created_at default

Revision ID: 67ecd88eb452
Revises: 9cf95ebdeaca
Create Date: 2025-08-22 22:35:45.356074

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '67ecd88eb452'
down_revision: Union[str, Sequence[str], None] = '9cf95ebdeaca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade():
    # Ensure the column exists with timezone type; no-op if it already does
    # (Skip add_column since you already have the column; error shows it exists.)

    # Give the column a default for future inserts
    op.execute("ALTER TABLE grocery_list ALTER COLUMN created_at SET DEFAULT now()")

    # Backfill any existing NULLs (in case previous rows have null)
    op.execute("UPDATE grocery_list SET created_at = now() WHERE created_at IS NULL")

    # Enforce NOT NULL (safe after backfill)
    op.alter_column(
        "grocery_list",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )

def downgrade():
    # Make nullable again
    op.alter_column(
        "grocery_list",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    # Drop the default
    op.execute("ALTER TABLE grocery_list ALTER COLUMN created_at DROP DEFAULT")