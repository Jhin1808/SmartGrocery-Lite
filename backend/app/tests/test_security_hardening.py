import pytest


def test_public_deployment_rejects_default_secrets(monkeypatch):
    from app.config import load_secret

    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.setenv("FRONTEND_URL", "https://smartgrocery.online")

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        load_secret(
            "SECRET_KEY",
            fallback_names=("JWT_SECRET_KEY",),
            dev_default="change-me-in-dev",
        )


def test_token_endpoint_does_not_return_bearer_token_by_default(client, test_user):
    from app.database import get_db
    from app.security import hash_password

    db_override = client.app.dependency_overrides[get_db]
    db = next(db_override())
    try:
        user = db.get(type(test_user), test_user.id)
        user.password_hash = hash_password("correct-password")
        db.commit()
    finally:
        db.close()

    r = client.post(
        "/auth/token",
        data={"username": test_user.email, "password": "correct-password"},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )

    assert r.status_code == 200, r.text
    assert "access_token" not in r.json()
    assert "access_token" in r.cookies


def test_cookie_mutation_rejects_untrusted_origin(client):
    client.cookies.set("access_token", "fake-cookie-for-csrf-check")

    r = client.post(
        "/lists/",
        json={"name": "Cross-site attempt"},
        headers={"origin": "https://evil.example"},
    )

    assert r.status_code == 403


def test_cookie_mutation_allows_configured_frontend_origin(client):
    client.cookies.set("access_token", "fake-cookie-for-csrf-check")

    r = client.post(
        "/lists/",
        json={"name": "Same frontend"},
        headers={"origin": "http://localhost:3000"},
    )

    assert r.status_code == 201, r.text


def test_run_reminders_requires_configured_secret(client, monkeypatch):
    monkeypatch.delenv("CRON_SECRET", raising=False)

    r = client.post("/tasks/run-reminders")

    assert r.status_code == 503
