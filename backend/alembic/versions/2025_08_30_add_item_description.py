"""
Add description field to list_item

Revision ID: add_item_description_20250830
Revises: fba5514dc439
Create Date: 2025-08-30
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_item_description_20250830'
down_revision = 'fba5514dc439'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('list_item', sa.Column('description', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('list_item', 'description')

