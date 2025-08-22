"""oauth-ready-user

Revision ID: b5808e13b4f7
Revises: a028b9060362
Create Date: 2025-08-22 01:26:55.995821

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b5808e13b4f7'
down_revision: Union[str, Sequence[str], None] = 'a028b9060362'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    # 1) make password_hash nullable (safe even if already nullable)
    op.alter_column("user", "password_hash", existing_type=sa.String(), nullable=True)

    # 2) add google_sub if missing
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS google_sub VARCHAR')

    # 3) unique when present (partial index) — safe create
    op.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_sub_unique '
        'ON "user" (google_sub) WHERE google_sub IS NOT NULL'
    )

    # 4) must have at least one credential (pwd or google) — add only if not present
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_user_has_credential'
                  AND conrelid = 'user'::regclass
            ) THEN
                ALTER TABLE "user"
                ADD CONSTRAINT ck_user_has_credential
                CHECK ((password_hash IS NOT NULL) OR (google_sub IS NOT NULL));
            END IF;
        END$$;
        """
    )

def downgrade():
    # reverse in a tolerant way
    op.execute('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS ck_user_has_credential')
    op.execute('DROP INDEX IF EXISTS ix_user_google_sub_unique')
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS google_sub')
    # make password_hash NOT NULL again (may fail if rows violate; this is expected in dev only)
    op.alter_column("user", "password_hash", existing_type=sa.String(), nullable=False)
