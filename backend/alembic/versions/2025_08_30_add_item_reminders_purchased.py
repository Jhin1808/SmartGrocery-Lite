"""
Add remind_on, reminded_at, purchased to list_item

Revision ID: add_item_reminders_purchased_20250830
Revises: add_item_description_20250830
Create Date: 2025-08-30
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_item_reminders_purchased_20250830'
down_revision = 'add_item_description_20250830'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('list_item', sa.Column('remind_on', sa.Date(), nullable=True))
    op.add_column('list_item', sa.Column('reminded_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('list_item', sa.Column('purchased', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('list_item', 'purchased')
    op.drop_column('list_item', 'reminded_at')
    op.drop_column('list_item', 'remind_on')

