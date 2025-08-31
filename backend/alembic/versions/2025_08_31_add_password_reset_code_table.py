"""
add password_reset_code table

Revision ID: 2025_08_31_add_password_reset_code_table
Revises: 2025_08_30_add_item_reminders_purchased
Create Date: 2025-08-31
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_08_31_add_password_reset_code_table'
down_revision = '2025_08_30_add_item_reminders_purchased'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'password_reset_code',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('code_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_password_reset_code_user_id', 'password_reset_code', ['user_id'], unique=False)
    op.create_index('ix_prc_user_active', 'password_reset_code', ['user_id', 'expires_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_prc_user_active', table_name='password_reset_code')
    op.drop_index('ix_password_reset_code_user_id', table_name='password_reset_code')
    op.drop_table('password_reset_code')

