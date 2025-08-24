# backend/alembic/env.py
import os
from urllib.parse import quote_plus
from alembic import context
from sqlalchemy import engine_from_config, pool

# 🔹 Import your models' Base
from app.models import Base

config = context.config

def _db_url_from_env():
    url = (os.getenv("DATABASE_URL") or "").strip().strip('"').strip("'")
    if url:
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if "supabase" in url and "sslmode=" not in url:
            url += ("&" if "?" in url else "?") + "sslmode=require"
        return url

    user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER") or os.getenv("user")
    pwd  = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD") or os.getenv("password")
    host = os.getenv("PGHOST") or os.getenv("host")
    port = os.getenv("PGPORT") or os.getenv("port") or "5432"
    db   = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB") or os.getenv("dbname") or "postgres"
    if not all([user, pwd, host, port, db]):
        return None
    return f"postgresql+psycopg2://{user}:{quote_plus(pwd)}@{host}:{port}/{db}?sslmode=require"

db_url = _db_url_from_env()
if not db_url:
    raise RuntimeError("Alembic could not build DB URL. Set DATABASE_URL or PG* env vars.")
config.set_main_option("sqlalchemy.url", db_url)

# 🔹 This is the key: let Alembic autogenerate from your models
target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
