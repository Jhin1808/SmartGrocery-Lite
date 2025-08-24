"""baseline schema: users, lists, items, sharing"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum  # <-- THIS is the missing import

# revision identifiers, used by Alembic.
revision: str = "fba5514dc439"         # keep this matching your filename
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # --- enum: share_role ---
    share_role_type = PGEnum("viewer", "editor", name="share_role")
    share_role_type.create(bind, checkfirst=True)  # create once if missing

    # --- user ---
    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("password_hash", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("google_sub", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("picture", sa.String(), nullable=True),
    )
    op.create_index("uq_user_email", "user", ["email"], unique=True)
    op.create_index("ix_user_google_sub", "user", ["google_sub"], unique=False)

    # --- grocery_list ---
    op.create_table(
        "grocery_list",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_grocery_list_owner", "grocery_list", ["owner_id"], unique=False)

    # --- list_item ---
    op.create_table(
        "list_item",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("expiry", sa.Date(), nullable=True),
        sa.Column(
            "list_id",
            sa.Integer(),
            sa.ForeignKey("grocery_list.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_list_item_list", "list_item", ["list_id"], unique=False)

    # --- list_share ---
    op.create_table(
        "list_share",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "list_id",
            sa.Integer(),
            sa.ForeignKey("grocery_list.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role",
            PGEnum(name="share_role", create_type=False),  # reuse existing enum
            nullable=False,
            server_default=sa.text("'viewer'"),
        ),
        sa.Column(
            "hidden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.UniqueConstraint("list_id", "user_id", name="uq_list_share_list_user"),
    )
    op.create_index("ix_list_share_list", "list_share", ["list_id"], unique=False)
    op.create_index("ix_list_share_user", "list_share", ["user_id"], unique=False)


def downgrade() -> None:
    # drop tables in reverse order
    op.drop_index("ix_list_share_user", table_name="list_share")
    op.drop_index("ix_list_share_list", table_name="list_share")
    op.drop_table("list_share")

    op.drop_index("ix_list_item_list", table_name="list_item")
    op.drop_table("list_item")

    op.drop_index("ix_grocery_list_owner", table_name="grocery_list")
    op.drop_table("grocery_list")

    op.drop_index("ix_user_google_sub", table_name="user")
    op.drop_index("uq_user_email", table_name="user")
    op.drop_table("user")

    # finally drop the enum
    share_role_type = PGEnum("viewer", "editor", name="share_role")
    share_role_type.drop(op.get_bind(), checkfirst=True)
