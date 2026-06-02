"""
Add catalog / stores / recipes tables and extend list_item.

Revision ID: 2026_05_31_catalog
Revises: add_used_reset_token_20250831
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2026_05_31_catalog'
down_revision = 'add_urt_250831'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Extend list_item with catalog fields
    op.add_column('list_item', sa.Column('category', sa.String(length=64), nullable=True))
    op.add_column('list_item', sa.Column('subcategory', sa.String(length=64), nullable=True))
    op.add_column('list_item', sa.Column('weight_value', sa.Float(), nullable=True))
    op.add_column('list_item', sa.Column('weight_unit', sa.String(length=8), nullable=True))
    op.add_column('list_item', sa.Column('brand', sa.String(length=120), nullable=True))
    op.add_column('list_item', sa.Column('barcode', sa.String(length=32), nullable=True))
    op.add_column('list_item', sa.Column('product_image_url', sa.String(length=2048), nullable=True))
    op.add_column('list_item', sa.Column('price', sa.Float(), nullable=True))
    op.add_column('list_item', sa.Column('price_source', sa.String(), nullable=True))
    op.add_column('list_item', sa.Column('store_id', sa.Integer(), nullable=True))
    op.add_column('list_item', sa.Column('nutrition_json', sa.JSON(), nullable=True))

    op.create_index('ix_list_item_category', 'list_item', ['category'])
    op.create_index('ix_list_item_brand', 'list_item', ['brand'])
    op.create_index('ix_list_item_barcode', 'list_item', ['barcode'])

    # 2) connected_store
    op.create_table(
        'connected_store',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source', sa.String(), nullable=False, server_default='kroger'),
        sa.Column('chain', sa.String(), nullable=False),
        sa.Column('location_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lng', sa.Float(), nullable=True),
        sa.Column('connected_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'source', 'location_id', name='uq_connected_store_user_source_loc'),
    )
    op.create_index('ix_connected_store_user_id', 'connected_store', ['user_id'])

    # 3) list_item.store_id FK
    op.create_foreign_key(
        'fk_list_item_store_id',
        'list_item', 'connected_store',
        ['store_id'], ['id'],
        ondelete='SET NULL',
    )

    # 4) product_cache
    op.create_table(
        'product_cache',
        sa.Column('key', sa.String(), primary_key=True),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('endpoint', sa.String(), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 5) taxonomy_entry
    op.create_table(
        'taxonomy_entry',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('canonical', sa.String(), nullable=False),
        sa.Column('display', sa.String(), nullable=False),
        sa.Column('parent_slug', sa.String(), nullable=True),
        sa.Column('top_level', sa.String(), nullable=True),
        sa.UniqueConstraint('slug', name='uq_taxonomy_entry_slug'),
    )
    op.create_index('ix_taxonomy_entry_slug', 'taxonomy_entry', ['slug'])
    op.create_index('ix_taxonomy_entry_canonical', 'taxonomy_entry', ['canonical'])
    op.create_index('ix_taxonomy_entry_top_level', 'taxonomy_entry', ['top_level'])

    # 6) recipe
    op.create_table(
        'recipe',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('external_id', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=False, server_default='mealdb'),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('servings', sa.Integer(), nullable=True),
        sa.Column('ready_minutes', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('area', sa.String(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('raw_json', sa.JSON(), nullable=True),
        sa.Column('cached_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('external_id', name='uq_recipe_external_id'),
    )
    op.create_index('ix_recipe_external_id', 'recipe', ['external_id'])

    # 7) recipe_ingredient
    op.create_table(
        'recipe_ingredient',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('recipe_id', sa.Integer(), sa.ForeignKey('recipe.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('measure', sa.String(), nullable=True),
        sa.Column('original', sa.String(), nullable=True),
        sa.Column('aisle', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('ix_recipe_ingredient_recipe_id', 'recipe_ingredient', ['recipe_id'])


def downgrade() -> None:
    op.drop_table('recipe_ingredient')
    op.drop_index('ix_recipe_external_id', table_name='recipe')
    op.drop_table('recipe')
    op.drop_index('ix_taxonomy_entry_top_level', table_name='taxonomy_entry')
    op.drop_index('ix_taxonomy_entry_canonical', table_name='taxonomy_entry')
    op.drop_index('ix_taxonomy_entry_slug', table_name='taxonomy_entry')
    op.drop_table('taxonomy_entry')
    op.drop_table('product_cache')
    op.drop_constraint('fk_list_item_store_id', 'list_item', type_='foreignkey')
    op.drop_index('ix_connected_store_user_id', table_name='connected_store')
    op.drop_table('connected_store')
    op.drop_index('ix_list_item_barcode', table_name='list_item')
    op.drop_index('ix_list_item_brand', table_name='list_item')
    op.drop_index('ix_list_item_category', table_name='list_item')
    op.drop_column('list_item', 'nutrition_json')
    op.drop_column('list_item', 'store_id')
    op.drop_column('list_item', 'price_source')
    op.drop_column('list_item', 'price')
    op.drop_column('list_item', 'product_image_url')
    op.drop_column('list_item', 'barcode')
    op.drop_column('list_item', 'brand')
    op.drop_column('list_item', 'weight_unit')
    op.drop_column('list_item', 'weight_value')
    op.drop_column('list_item', 'subcategory')
    op.drop_column('list_item', 'category')
