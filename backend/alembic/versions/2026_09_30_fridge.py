"""Add personal fridge inventory."""
from alembic import op
import sqlalchemy as sa
revision = "2026_09_30_fridge"
down_revision = "2026_06_02_security_lockdown"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("fridge_item", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit", sa.String(30), nullable=False), sa.Column("expiry", sa.Date()))
    op.create_index("ix_fridge_item_owner_id", "fridge_item", ["owner_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE public.fridge_item ENABLE ROW LEVEL SECURITY")
        op.execute("REVOKE ALL ON TABLE public.fridge_item FROM anon, authenticated, public")
        op.execute("REVOKE ALL ON SEQUENCE public.fridge_item_id_seq FROM anon, authenticated, public")
        op.execute("GRANT ALL ON TABLE public.fridge_item TO service_role")
        op.execute("GRANT ALL ON SEQUENCE public.fridge_item_id_seq TO service_role")

def downgrade():
    op.drop_index("ix_fridge_item_owner_id", table_name="fridge_item")
    op.drop_table("fridge_item")
