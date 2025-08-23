import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine
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

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # avoids stale connections in pooler
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
