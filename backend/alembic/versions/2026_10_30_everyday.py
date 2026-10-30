"""Account staples, recent purchases, weekly restocks and retry-safe demo imports."""
from alembic import op
import sqlalchemy as sa

revision = "2026_10_30_everyday"
down_revision = "2026_06_02_security_lockdown"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("staple",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_key", sa.String(300), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.UniqueConstraint("user_id", "name_key", name="uq_staple_user_name"))
    op.create_index("ix_staple_user_id", "staple", ["user_id"])
    op.create_table("purchase_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_key", sa.String(300), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("last_purchased_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "name_key", name="uq_purchase_user_name"))
    op.create_index("ix_purchase_history_user_id", "purchase_history", ["user_id"])
    op.create_table("restock_run",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("list_id", sa.Integer(), sa.ForeignKey("grocery_list.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.UniqueConstraint("user_id", "list_id", "week_start", name="uq_restock_user_list_week"))
    op.create_table("demo_import",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("import_key", sa.String(36), nullable=False),
        sa.Column("list_id", sa.Integer(), sa.ForeignKey("grocery_list.id", ondelete="SET NULL")),
        sa.UniqueConstraint("user_id", "import_key", name="uq_demo_import_user_key"))
    if op.get_bind().dialect.name == "postgresql":
        for table in ("staple", "purchase_history", "restock_run", "demo_import"):
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
            op.execute(f'REVOKE ALL ON TABLE "{table}" FROM PUBLIC')
            op.execute(f'REVOKE ALL ON SEQUENCE "{table}_id_seq" FROM PUBLIC')
            op.execute(f'''DO $$ BEGIN
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                GRANT ALL ON TABLE "{table}" TO service_role;
                GRANT ALL ON SEQUENCE "{table}_id_seq" TO service_role;
              END IF;
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                REVOKE ALL ON TABLE "{table}" FROM anon;
                REVOKE ALL ON SEQUENCE "{table}_id_seq" FROM anon;
              END IF;
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                REVOKE ALL ON TABLE "{table}" FROM authenticated;
                REVOKE ALL ON SEQUENCE "{table}_id_seq" FROM authenticated;
              END IF;
            END $$''')


def downgrade():
    for table in ("demo_import", "restock_run", "purchase_history", "staple"):
        op.drop_table(table)
