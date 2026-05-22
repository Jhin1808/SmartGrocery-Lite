import os
from urllib.parse import urlparse


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


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
        names = " or ".join(checked)
        raise RuntimeError(f"{names} must be set in production")
    return dev_default
