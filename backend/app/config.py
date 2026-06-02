import os
import secrets
from urllib.parse import urlparse


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}
_EPHEMERAL_SECRET_CACHE: dict[str, str] = {}


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# -------- Catalog / Recipes (M1+) --------

# Open Food Facts (free, no key)
OFF_BASE_URL = (os.getenv("OFF_BASE_URL") or "https://world.openfoodfacts.org").rstrip("/")
# TheMealDB (free, no key)
MEALDB_BASE_URL = (os.getenv("MEALDB_BASE_URL") or "https://www.themealdb.com/api/json/v1/1").rstrip("/")
# Kroger Public API (free, register at https://developer.kroger.com)
KROGER_BASE_URL = (os.getenv("KROGER_BASE_URL") or "https://api.kroger.com").rstrip("/")
KROGER_CLIENT_ID = (os.getenv("KROGER_CLIENT_ID") or "").strip()
KROGER_CLIENT_SECRET = (os.getenv("KROGER_CLIENT_SECRET") or "").strip()
KROGER_SCOPES = (os.getenv("KROGER_SCOPES") or "product.compact").strip()
KROGER_TOKEN_CACHE_TTL_SECONDS = env_int("KROGER_TOKEN_CACHE_TTL_SECONDS", 1500)

# Cache + rate limiting
CATALOG_CACHE_TTL_HOURS = env_int("CATALOG_CACHE_TTL_HOURS", 24)
CATALOG_TIMEOUT_SECONDS = env_float("CATALOG_TIMEOUT_SECONDS", 4.0)
CATALOG_RATE_LIMIT_PER_MIN = env_int("CATALOG_RATE_LIMIT_PER_MIN", 30)

# Reserved for future paid tier (off in v1)
SPOONACULAR_API_KEY = (os.getenv("SPOONACULAR_API_KEY") or "").strip()
EDAMAM_APP_ID = (os.getenv("EDAMAM_APP_ID") or "").strip()
EDAMAM_APP_KEY = (os.getenv("EDAMAM_APP_KEY") or "").strip()


def kroger_configured() -> bool:
    return bool(KROGER_CLIENT_ID and KROGER_CLIENT_SECRET)


def _public_url_configured(value: str | None) -> bool:
    if not value:
        return False
    for raw in value.split(","):
        raw = raw.strip()
        if not raw:
            continue
        candidate = raw if "://" in raw else f"https://{raw}"
        parsed = urlparse(candidate)
        host = (parsed.hostname or "").lower()
        if host and host not in LOCAL_HOSTS and not host.endswith(".localhost"):
            return True
    return False


def is_production_like() -> bool:
    env_name = (
        os.getenv("ENVIRONMENT")
        or os.getenv("APP_ENV")
        or os.getenv("ENV")
        or ""
    ).strip().lower()
    if env_flag("REQUIRE_STRONG_SECRETS"):
        return True
    if env_name in {"prod", "production", "staging"}:
        return True
    return _public_url_configured(os.getenv("FRONTEND_URL"))


def is_koyeb_environment() -> bool:
    return any(name.startswith("KOYEB_") for name in os.environ)


def _get_ephemeral_secret(names: tuple[str, ...], min_length: int) -> str:
    for name in names:
        value = _EPHEMERAL_SECRET_CACHE.get(name)
        if value:
            return value

    value = secrets.token_urlsafe(max(32, min_length))
    for name in names:
        _EPHEMERAL_SECRET_CACHE[name] = value
    return value


def load_secret(
    primary_name: str,
    *,
    fallback_names: tuple[str, ...] = (),
    dev_default: str,
    min_length: int = 32,
) -> str:
    checked = (primary_name, *fallback_names)
    for name in checked:
        value = (os.getenv(name) or "").strip()
        if value:
            if is_production_like() and len(value) < min_length:
                raise RuntimeError(f"{name} must be at least {min_length} characters in production")
            if is_production_like() and value == dev_default:
                raise RuntimeError(f"{name} must not use the development default in production")
            return value

    if is_production_like():
        if is_koyeb_environment() and not env_flag("REQUIRE_STRONG_SECRETS"):
            return _get_ephemeral_secret(checked, min_length)
        names = " or ".join(checked)
        raise RuntimeError(f"{names} must be set in production")
    return dev_default


def get_frontend_url() -> str:
    """Return the canonical frontend URL (no trailing slash, https by default)."""
    v = (os.getenv("FRONTEND_URL") or "http://localhost:3000").strip().strip('"').strip("'")
    v = v.rstrip("/")
    if v and not v.startswith("http://") and not v.startswith("https://"):
        v = ("http://" if "localhost" in v else "https://") + v
    return v
