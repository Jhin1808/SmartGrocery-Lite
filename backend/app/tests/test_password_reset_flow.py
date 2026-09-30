"""Exercise the reset code lifecycle with a local user and mocked delivery."""

from app.routers import auth
import httpx


def test_reset_config_reflects_server_verification(monkeypatch, client):
    monkeypatch.delenv("TURNSTILE_SECRET", raising=False)
    assert client.get("/auth/password-reset-config").json() == {
        "captcha_required": False, "site_key": None,
    }

    monkeypatch.setenv("TURNSTILE_SECRET", "test-verification-secret")
    monkeypatch.setenv("TURNSTILE_SITE_KEY", "test-public-site-key")
    assert client.get("/auth/password-reset-config").json() == {
        "captcha_required": True, "site_key": "test-public-site-key",
    }


def test_forgot_requires_and_verifies_turnstile(monkeypatch, client, test_user):
    monkeypatch.setenv("TURNSTILE_SECRET", "test-verification-secret")
    monkeypatch.setenv("DISABLE_RATE_LIMITS", "1")
    sent = []
    monkeypatch.setattr(auth, "_send_reset_code_email", lambda **kwargs: sent.append(kwargs))
    assert client.post("/auth/forgot-password", json={"email": test_user.email}).status_code == 400

    def verify(url, *, data, timeout):
        assert url == "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        assert data == {"secret": "test-verification-secret", "response": "challenge-token"}
        return httpx.Response(200, json={"success": True})

    monkeypatch.setattr(httpx, "post", verify)
    response = client.post("/auth/forgot-password", json={
        "email": test_user.email, "captcha_token": "challenge-token",
    })
    assert response.status_code == 200
    assert len(sent) == 1


def test_forgot_to_reset_to_login_with_case_insensitive_email(monkeypatch, client, test_user):
    monkeypatch.delenv("TURNSTILE_SECRET", raising=False)
    monkeypatch.setenv("DISABLE_RATE_LIMITS", "1")
    sent = []
    monkeypatch.setattr(auth, "_send_reset_code_email", lambda **kwargs: sent.append(kwargs))

    requested = client.post("/auth/forgot-password", json={"email": test_user.email.upper()})
    assert requested.status_code == 200
    assert requested.json() == {"ok": True}
    assert len(sent) == 1
    assert sent[0]["to"] == test_user.email

    reset = client.post("/auth/reset-password", json={
        "email": test_user.email.upper(),
        "code": sent[0]["code"],
        "new_password": "new-password-123",
    })
    assert reset.status_code == 204

    login = client.post("/auth/token", data={
        "username": test_user.email,
        "password": "new-password-123",
    })
    assert login.status_code == 200
    assert "access_token" in login.cookies
