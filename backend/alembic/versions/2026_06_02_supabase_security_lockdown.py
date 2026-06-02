"""Lock down direct Supabase client access to app tables.

Revision ID: 2026_06_02_security_lockdown
Revises: 2026_06_01_list_templates
Create Date: 2026-06-02
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_06_02_security_lockdown"
down_revision = "2026_06_01_list_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Keep SmartGrocery data behind the backend/service role.

    The app uses its FastAPI backend as the authorization boundary. These
    revokes prevent direct browser scripts, anon keys, or regular Supabase
    authenticated clients from reading or mutating the app tables.
    """

    op.execute(
        """
        drop policy if exists "public_can_read" on public.grocery_list;
        drop policy if exists "list_item_select_public" on public.list_item;
        drop policy if exists "list_item_admin_all" on public.list_item;
        drop policy if exists "list_share_select_public" on public.list_share;

        alter table if exists public.alembic_version enable row level security;
        alter table if exists public."user" enable row level security;
        alter table if exists public.grocery_list enable row level security;
        alter table if exists public.list_item enable row level security;
        alter table if exists public.list_share enable row level security;
        alter table if exists public.password_reset_code enable row level security;
        alter table if exists public.used_reset_token enable row level security;
        alter table if exists public.connected_store enable row level security;
        alter table if exists public.product_cache enable row level security;
        alter table if exists public.taxonomy_entry enable row level security;
        alter table if exists public.recipe enable row level security;
        alter table if exists public.recipe_ingredient enable row level security;
        alter table if exists public.list_template enable row level security;
        alter table if exists public.list_template_item enable row level security;

        revoke all privileges on all tables in schema public from anon;
        revoke all privileges on all tables in schema public from authenticated;
        revoke all privileges on all tables in schema public from public;

        revoke all privileges on all sequences in schema public from anon;
        revoke all privileges on all sequences in schema public from authenticated;
        revoke all privileges on all sequences in schema public from public;

        revoke all privileges on all functions in schema public from anon;
        revoke all privileges on all functions in schema public from authenticated;
        revoke all privileges on all functions in schema public from public;

        revoke all privileges on all tables in schema private from anon;
        revoke all privileges on all tables in schema private from authenticated;
        revoke all privileges on all tables in schema private from public;

        revoke all privileges on all sequences in schema private from anon;
        revoke all privileges on all sequences in schema private from authenticated;
        revoke all privileges on all sequences in schema private from public;

        revoke all privileges on all functions in schema private from anon;
        revoke all privileges on all functions in schema private from authenticated;
        revoke all privileges on all functions in schema private from public;

        grant usage on schema public to service_role;
        grant all privileges on all tables in schema public to service_role;
        grant all privileges on all sequences in schema public to service_role;
        grant all privileges on all functions in schema public to service_role;

        grant usage on schema private to service_role;
        grant all privileges on all tables in schema private to service_role;
        grant all privileges on all sequences in schema private to service_role;
        grant all privileges on all functions in schema private to service_role;

        alter default privileges in schema public revoke all on tables from anon;
        alter default privileges in schema public revoke all on tables from authenticated;
        alter default privileges in schema public revoke all on tables from public;
        alter default privileges in schema public revoke all on sequences from anon;
        alter default privileges in schema public revoke all on sequences from authenticated;
        alter default privileges in schema public revoke all on sequences from public;
        alter default privileges in schema public revoke all on functions from anon;
        alter default privileges in schema public revoke all on functions from authenticated;
        alter default privileges in schema public revoke all on functions from public;

        alter default privileges in schema private revoke all on tables from anon;
        alter default privileges in schema private revoke all on tables from authenticated;
        alter default privileges in schema private revoke all on tables from public;
        alter default privileges in schema private revoke all on sequences from anon;
        alter default privileges in schema private revoke all on sequences from authenticated;
        alter default privileges in schema private revoke all on sequences from public;
        alter default privileges in schema private revoke all on functions from anon;
        alter default privileges in schema private revoke all on functions from authenticated;
        alter default privileges in schema private revoke all on functions from public;
        """
    )


def downgrade() -> None:
    # Intentionally do not reopen direct client access on downgrade.
    pass
