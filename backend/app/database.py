import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker

def build_db_url() -> str:
    # 1) Prefer single DATABASE_URL if present
    url = (os.getenv("DATABASE_URL") or "").strip().strip('"').strip("'")
    if url:
        # normalize if someone sets postgres://
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        # Supabase needs SSL; if missing, append it
        if "supabase" in url and "sslmode=" not in url:
            url += ("&" if "?" in url else "?") + "sslmode=require"
        return url

    # 2) Fallback to discrete PG* variables (for local/dev)
    user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER") or os.getenv("user")
    pwd  = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD") or os.getenv("password")
    host = os.getenv("PGHOST") or os.getenv("host")
    port = os.getenv("PGPORT") or os.getenv("port") or "5432"
    db   = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB") or os.getenv("dbname") or "postgres"
    if not all([user, pwd, host, port, db]):
        raise RuntimeError("DB config missing: set DATABASE_URL or PG* env vars.")
    return f"postgresql+psycopg2://{user}:{quote_plus(pwd)}@{host}:{port}/{db}?sslmode=require"

DATABASE_URL = build_db_url()

# Prefer letting PgBouncer/Supabase pooler handle pooling in production.
# Defaults:
# - If DATABASE_URL contains "supabase", default to NullPool (open/close per request)
# - Otherwise, allow a very small QueuePool unless explicitly overridden

_env_disable_pool = os.getenv("DB_DISABLE_POOL")
_default_disable_pool = ("supabase" in DATABASE_URL.lower())
_disable_pool = (
    _default_disable_pool if _env_disable_pool is None
    else (_env_disable_pool.lower() in ("1", "true", "yes"))
)

if _disable_pool:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        poolclass=NullPool,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=int(os.getenv("DB_POOL_SIZE", "1")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "0")),
    )
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
