import os


def relay_secret() -> str:
    secret = (os.getenv("EMAIL_RELAY_SECRET") or "").strip()
    if len(secret) < 32:
        raise RuntimeError("EMAIL_RELAY_SECRET must be at least 32 characters")
    return secret
