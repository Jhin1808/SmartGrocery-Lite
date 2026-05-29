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


def test_run_reminders_escapes_user_content_in_email_html(client, test_user, monkeypatch):
    from datetime import date

    from app.database import get_db
    from app.models import GroceryList, ListItem, User
    from app.routers import tasks

    db_override = client.app.dependency_overrides[get_db]
    db = next(db_override())
    try:
        user = db.get(User, test_user.id)
        user.name = "<img src=x onerror=alert(1)>"
        grocery_list = GroceryList(name="<script>alert(1)</script>", owner_id=user.id)
        db.add(grocery_list)
        db.flush()
        db.add(
            ListItem(
                name="<b>Milk</b>",
                quantity=1,
                remind_on=date.today(),
                purchased=False,
                list_id=grocery_list.id,
            )
        )
        db.commit()
    finally:
        db.close()

    sent = {}

    def fake_send_email(to, subject, html, text=None):
        sent["html"] = html

    monkeypatch.setenv("CRON_SECRET", "test-cron-secret")
    monkeypatch.setattr(tasks, "_send_email", fake_send_email)

    r = client.post("/tasks/run-reminders", headers={"x-api-key": "test-cron-secret"})

    assert r.status_code == 200, r.text
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in sent["html"]
    assert "&lt;b&gt;Milk&lt;/b&gt;" in sent["html"]
    assert "<script>alert(1)</script>" not in sent["html"]
    assert "<b>Milk</b>" not in sent["html"]
