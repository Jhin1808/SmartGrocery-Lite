"""
add used_reset_token table for single-use link tokens

Revision ID: 2025_08_31_add_used_reset_token_table
Revises: 2025_08_31_add_password_reset_code_table
Create Date: 2025-08-31
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_08_31_add_used_reset_token_table'
down_revision = '2025_08_31_add_password_reset_code_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'used_reset_token',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('jti', sa.String(), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti')
    )
    op.create_index('ix_used_reset_token_user_id', 'used_reset_token', ['user_id'], unique=False)
    op.create_index('ix_used_reset_token_jti', 'used_reset_token', ['jti'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_used_reset_token_jti', table_name='used_reset_token')
    op.drop_index('ix_used_reset_token_user_id', table_name='used_reset_token')
    op.drop_table('used_reset_token')

