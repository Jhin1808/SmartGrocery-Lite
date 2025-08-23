"""set default on list_share.hidden

Revision ID: 0e589c162ccc
Revises: 67ecd88eb452
Create Date: 2025-08-22 22:42:30.941162

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e589c162ccc'
down_revision: Union[str, Sequence[str], None] = '67ecd88eb452'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # In case any old rows somehow had NULLs (unlikely if NOT NULL was enforced)
    op.execute("UPDATE list_share SET hidden = false WHERE hidden IS NULL")
    # Set a server default for future inserts
    op.execute("ALTER TABLE list_share ALTER COLUMN hidden SET DEFAULT false")
    # Ensure NOT NULL is enforced
    op.alter_column(
        "list_share",
        "hidden",
        existing_type=sa.Boolean(),
        nullable=False,
    )

def downgrade():
    # Remove default; keep NOT NULL as-is (or relax if you want)
    op.execute("ALTER TABLE list_share ALTER COLUMN hidden DROP DEFAULT")