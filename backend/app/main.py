# app/main.py
import os
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from urllib.parse import urlparse
from app.database import engine
from app.config import load_secret, CATALOG_TIMEOUT_SECONDS
from app.security_cookies import COOKIE_NAME
from app.routers.lists import router as lists_router
from app.routers.auth import router as auth_router
from app.routers.catalog import router as catalog_router
from app.routers.stores import router as stores_router
from app.routers.auth_kroger import router as auth_kroger_router
from app.routers.recipes import router as recipes_router
from app.routers.templates import router as templates_router
google_router = None
try:
    from app.routers.auth_google import router as google_router
except Exception:
    # In test or minimal environments, Google OAuth deps or env may be missing.
    # Skip loading the Google router in that case.
    google_router = None
from app.routers.me import router as me_router
from app.routers.tasks import router as tasks_router
try:
    from app.routers.email_test import router as email_test_router
except Exception:
    email_test_router = None
# One env only; can be single origin or comma-separated list
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in FRONTEND_URL.split(",") if o.strip()]
SESSION_SECRET = load_secret(
    "SESSION_SECRET",
    fallback_names=("SECRET_KEY",),
    dev_default="dev-insecure",
)
COOKIE_SAMESITE = (os.getenv("COOKIE_SAMESITE", "lax") or "lax").lower()
COOKIE_SECURE = (os.getenv("COOKIE_SECURE", "false") or "false").lower() in ("1", "true", "yes")
# Enforce Secure when SameSite=None to comply with browser rules
if COOKIE_SAMESITE == "none" and not COOKIE_SECURE:
    COOKIE_SECURE = True
@asynccontextmanager
async def _lifespan(app: FastAPI):
    # Single shared HTTP client for all catalog/recipe upstream calls.
    app.state.http = httpx.AsyncClient(timeout=CATALOG_TIMEOUT_SECONDS)
    # One-time taxonomy seed (idempotent) so the /catalog/categories endpoint
    # can be served from the DB if a future migration wants to filter/sort it.
    try:
        from app.catalog.taxonomy import ensure_taxonomy_in_db, get_cached_taxonomy
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            ensure_taxonomy_in_db(db, get_cached_taxonomy())
        finally:
            db.close()
    except Exception:
        # Don't fail startup on taxonomy seed issues; the in-memory tree
        # still works.
        pass
    # One-time list-template seed (idempotent) so /templates is populated
    # the first time the app starts against a fresh DB.
    try:
        from app.templates_seed import ensure_templates_in_db
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            ensure_templates_in_db(db)
        finally:
            db.close()
    except Exception:
        # Don't fail startup on template seed issues.
        pass
    try:
        yield
    finally:
        await app.state.http.aclose()


app = FastAPI(title="SmartGrocery Lite API", version="0.1.0", lifespan=_lifespan)
# Koyeb sets X-Forwarded-Proto and X-Forwarded-Host headers.
# These are used in _request_origin() and CORS origin matching below.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # pass the list directly
    allow_credentials=True,          # cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site=COOKIE_SAMESITE,
    https_only=COOKIE_SECURE,
)
def _origin_value(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
def _request_origin(request: Request) -> str | None:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    scheme = (forwarded_proto or request.url.scheme or "http").split(",", 1)[0].strip()
    host = (forwarded_host or request.headers.get("host") or "").split(",", 1)[0].strip()
    if not host:
        return None
    return f"{scheme.lower()}://{host.lower()}"
def _allowed_request_origin(request: Request) -> bool:
    source = _origin_value(request.headers.get("origin"))
    if not source:
        source = _origin_value(request.headers.get("referer"))
    if not source:
        return False
    allowed = {o.lower() for o in ALLOWED_ORIGINS}
    current = _request_origin(request)
    if current:
        allowed.add(current)
    return source.lower() in allowed
@app.middleware("http")
async def reject_cross_site_cookie_mutations(request: Request, call_next):
    unsafe_method = request.method.upper() not in {"GET", "HEAD", "OPTIONS", "TRACE"}
    has_cookie_auth = COOKIE_NAME in request.cookies
    has_bearer_auth = (request.headers.get("authorization") or "").lower().startswith("bearer ")
    if unsafe_method and has_cookie_auth and not has_bearer_auth:
        if not _allowed_request_origin(request):
            return JSONResponse({"detail": "CSRF origin check failed"}, status_code=403)
    return await call_next(request)
app.include_router(lists_router)
app.include_router(auth_router)
if google_router is not None:
    app.include_router(google_router)
app.include_router(me_router)
app.include_router(tasks_router)
if email_test_router is not None:
    app.include_router(email_test_router)
# Catalog / Stores / Recipes (M1+)
app.include_router(catalog_router)
app.include_router(stores_router)
app.include_router(auth_kroger_router)
app.include_router(recipes_router)
# List Templates (M5)
app.include_router(templates_router)
# Removed startup connectivity check to avoid opening a DB connection at import time.
@app.get("/")
def root():
    return {"message": "Welcome to SmartGrocery Lite API"}
