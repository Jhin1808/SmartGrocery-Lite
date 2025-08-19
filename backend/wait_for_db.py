# backend/wait_for_db.py
import os, time
import psycopg2

host = "db"
db   = os.getenv("POSTGRES_DB", "smartgrocery")
user = os.getenv("POSTGRES_USER", "postgres")
pwd  = os.getenv("POSTGRES_PASSWORD", "postgres")
timeout = int(os.getenv("DB_WAIT_TIMEOUT", "120"))

start = time.time()
while True:
    try:
        conn = psycopg2.connect(host=host, dbname=db, user=user, password=pwd)
        conn.close()
        print("✅ DB is ready")
        break
    except Exception as e:
        if time.time() - start > timeout:
            raise SystemExit(f"❌ DB not ready after {timeout}s: {e}")
        print("⏳ Waiting for DB...", e)
        time.sleep(2)
