"""
Add list_template + list_template_item tables (M5).

Revision ID: 2026_06_01_list_templates
Revises: 2026_05_31_catalog
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2026_06_01_list_templates'
down_revision = '2026_05_31_catalog'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'list_template',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('slug', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('category', sa.String(length=40), nullable=True),
        sa.Column('emoji', sa.String(length=8), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('sort_index', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('slug', name='uq_list_template_slug'),
    )
    op.create_index('ix_list_template_slug', 'list_template', ['slug'])
    op.create_index('ix_list_template_category', 'list_template', ['category'])

    op.create_table(
        'list_template_item',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('list_template.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('sort_index', sa.Integer(), nullable=False, server_default='100'),
    )
    op.create_index('ix_list_template_item_template_id', 'list_template_item', ['template_id'])


def downgrade() -> None:
    op.drop_index('ix_list_template_item_template_id', table_name='list_template_item')
    op.drop_table('list_template_item')
    op.drop_index('ix_list_template_category', table_name='list_template')
    op.drop_index('ix_list_template_slug', table_name='list_template')
    op.drop_table('list_template')
