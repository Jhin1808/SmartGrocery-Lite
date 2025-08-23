"""add list sharing

Revision ID: c8295c653d6d
Revises: 4e9677484fae
Create Date: 2025-08-22 19:00:37.680136

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c8295c653d6d'
down_revision: Union[str, Sequence[str], None] = '4e9677484fae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        # Create enum type only if it doesn't already exist
        op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'share_role') THEN
                CREATE TYPE share_role AS ENUM ('viewer', 'editor');
            END IF;
        END $$;
        """)
        role_type = postgresql.ENUM("viewer", "editor", name="share_role", create_type=False)
    else:
        # SQLite etc.
        role_type = sa.String(length=16)

    # Create list_share table
    op.create_table(
        "list_share",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("list_id", sa.Integer(), sa.ForeignKey("grocery_list.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", role_type, nullable=False, server_default="viewer"),
    )

    op.create_index("ix_list_share_list_id", "list_share", ["list_id"])
    op.create_index("ix_list_share_user_id", "list_share", ["user_id"])
    op.create_unique_constraint("uq_list_share_list_user", "list_share", ["list_id", "user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.drop_constraint("uq_list_share_list_user", "list_share", type_="unique")
    op.drop_index("ix_list_share_user_id", table_name="list_share")
    op.drop_index("ix_list_share_list_id", table_name="list_share")
    op.drop_table("list_share")

    if is_pg:
        # Only drop the enum if nothing else uses it
        op.execute("DROP TYPE IF EXISTS share_role;")