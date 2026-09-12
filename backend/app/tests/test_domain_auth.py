from unittest.mock import AsyncMock

import pytest
from authlib.integrations.starlette_client import OAuthError
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse

from app.config import get_frontend_origins, get_frontend_url
from app.routers import auth_google
from app.security_cookies import set_login_cookie, clear_login_cookie


@pytest.mark.parametrize("value,expected", [
    ("https://www.tobuylists.com/,https://tobuylists.com", "https://www.tobuylists.com"),
    ('"www.tobuylists.com"', "https://www.tobuylists.com"),
    ("http://localhost:3000", "http://localhost:3000"),
])
def test_canonical_frontend_is_one_origin(monkeypatch, value, expected):
    monkeypatch.setenv("FRONTEND_URL", value)
    assert get_frontend_url() == expected


def test_cors_allows_both_new_frontend_hosts_but_not_unrelated_sites(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://www.tobuylists.com/")
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://tobuylists.com,https://www.tobuylists.com")
    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=get_frontend_origins(),
                       allow_credentials=True, allow_methods=["POST"])
    with TestClient(app) as client:
        for origin in ["https://www.tobuylists.com", "https://tobuylists.com"]:
            response = client.options("/lists/", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST",
            })
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin
            assert response.headers["access-control-allow-credentials"] == "true"
        denied = client.options("/lists/", headers={
            "Origin": "https://attacker.example", "Access-Control-Request-Method": "POST",
        })
        assert denied.status_code == 400
        assert "access-control-allow-origin" not in denied.headers


@pytest.mark.parametrize("origin", ["https://example.com/path", "https://user:pw@example.com", "https://example.com#x"])
def test_invalid_frontend_origin_is_rejected(monkeypatch, origin):
    monkeypatch.setenv("FRONTEND_URL", origin)
    with pytest.raises(ValueError):
        get_frontend_url()


def test_explicit_google_callback_survives_proxy_hostname(monkeypatch):
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://api.tobuylists.com/auth/google/callback")
    request = Request({"type": "http", "method": "GET", "path": "/auth/google/login",
                       "scheme": "http", "server": ("internal", 8000), "headers": []})
    assert auth_google._redirect_uri(request) == "https://api.tobuylists.com/auth/google/callback"


def test_google_login_uses_pinned_callback_and_signed_state_cookie(monkeypatch):
    monkeypatch.setattr(auth_google, "GOOGLE_CLIENT_ID", "test-client")
    monkeypatch.setattr(auth_google, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://api.tobuylists.com/auth/google/callback")

    async def authorize(request, uri):
        assert uri == "https://api.tobuylists.com/auth/google/callback"
        request.session["oauth_state"] = "test-state"
        return RedirectResponse("https://accounts.google.com/test")

    monkeypatch.setattr(auth_google.oauth.google, "authorize_redirect", authorize)
    app = FastAPI()
    app.add_middleware(SessionMiddleware, secret_key="test-stable-session-secret", https_only=True)
    app.include_router(auth_google.router)
    with TestClient(app, base_url="https://api.tobuylists.com") as client:
        response = client.get("/auth/google/login", follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == "https://accounts.google.com/test"
        cookie = response.headers["set-cookie"].lower()
        assert "session=" in cookie and "secure" in cookie and "httponly" in cookie


def test_oauth_state_failure_returns_actionable_error_to_canonical_frontend(monkeypatch, client):
    monkeypatch.setenv("FRONTEND_URL", "https://www.tobuylists.com,https://tobuylists.com")
    monkeypatch.setattr(auth_google, "GOOGLE_CLIENT_ID", "test-client")
    monkeypatch.setattr(auth_google, "GOOGLE_CLIENT_SECRET", "test-secret")
    monkeypatch.setattr(auth_google.oauth.google, "authorize_access_token",
                        AsyncMock(side_effect=OAuthError(error="mismatching_state")))
    response = client.get("/auth/google/callback?code=test&state=test", follow_redirects=False)
    assert response.headers["location"] == "https://www.tobuylists.com/login?auth_error=google_failed"
    assert "access_token=" not in response.headers.get("set-cookie", "")


def test_missing_google_config_returns_an_error_instead_of_a_missing_route(monkeypatch, client):
    monkeypatch.setenv("FRONTEND_URL", "https://www.tobuylists.com")
    monkeypatch.setattr(auth_google, "GOOGLE_CLIENT_ID", None)
    response = client.get("/auth/google/login", follow_redirects=False)
    assert response.headers["location"] == "https://www.tobuylists.com/login?auth_error=google_unavailable"


def test_successful_google_callback_keeps_token_in_host_only_cookie(monkeypatch, client, test_user):
    monkeypatch.setenv("FRONTEND_URL", "https://www.tobuylists.com,https://tobuylists.com")
    monkeypatch.setenv("COOKIE_SECURE", "1")
    monkeypatch.setenv("COOKIE_SAMESITE", "lax")
    monkeypatch.delenv("COOKIE_DOMAIN", raising=False)
    monkeypatch.setattr(auth_google, "GOOGLE_CLIENT_ID", "test-client")
    monkeypatch.setattr(auth_google, "GOOGLE_CLIENT_SECRET", "test-secret")
    monkeypatch.setattr(auth_google, "TOKEN_IN_FRAGMENT", False)
    monkeypatch.setattr(auth_google.oauth.google, "authorize_access_token", AsyncMock(return_value={
        "userinfo": {"email": test_user.email, "sub": "test-google-sub", "email_verified": True},
    }))
    response = client.get("/auth/google/callback?code=test&state=test", follow_redirects=False)
    assert response.headers["location"] == "https://www.tobuylists.com/oauth/callback"
    cookie = response.headers["set-cookie"].lower()
    assert "access_token=" in cookie and "httponly" in cookie and "secure" in cookie
    assert "samesite=lax" in cookie and "domain=" not in cookie


def test_cookie_logout_uses_same_scope_as_login(monkeypatch):
    monkeypatch.setenv("COOKIE_SECURE", "1")
    monkeypatch.setenv("COOKIE_SAMESITE", "lax")
    monkeypatch.delenv("COOKIE_DOMAIN", raising=False)
    login, logout = RedirectResponse("/"), RedirectResponse("/")
    set_login_cookie(login, "test-token")
    clear_login_cookie(logout)
    assert "Domain=" not in login.headers["set-cookie"]
    assert "Domain=" not in logout.headers["set-cookie"]
    assert "Max-Age=0" in logout.headers["set-cookie"]
