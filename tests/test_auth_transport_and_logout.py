"""Regression tests for two authentication defects.

1. Transport: the refresh cookie is ``Secure`` outside development, so it is
   never sent over plain HTTP and is only usable over HTTPS. The suite therefore
   needs a transport that can carry it (``secure_client``).

2. Logout: revoking only via the refresh cookie left a live access token behind
   whenever the cookie was absent. Logout must also revoke the session named by
   the *verified* access token's ``sid`` claim.
"""

from __future__ import annotations

import pytest


def _login(client, register_user, role: str = "candidate"):
    _, email, password = register_user(role)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, response


# ---------------------------------------------------------------------------
# Fix A - Secure cookies are transport-bound
# ---------------------------------------------------------------------------

def test_secure_refresh_cookie_is_not_sent_over_http(client, register_user):
    """Plain HTTP must not carry a Secure cookie - so refresh fails there."""
    from app.config import get_settings

    headers, login = _login(client, register_user)
    set_cookie = login.headers.get("set-cookie", "")

    if get_settings().refresh_cookie_secure:
        assert "Secure" in set_cookie
        # The cookie is set, but an http transport refuses to send it back.
        assert client.post("/api/v1/auth/refresh").status_code == 401
    else:
        # Development: not Secure, so the same transport carries it fine.
        assert "Secure" not in set_cookie
        assert client.post("/api/v1/auth/refresh").status_code == 200


def test_secure_refresh_cookie_is_sent_over_https(secure_client, register_user):
    """Over HTTPS the same cookie round-trips regardless of environment."""
    _, login = _login(secure_client, register_user)
    assert login.cookies.get("hireflow_refresh")

    refreshed = secure_client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]


def test_secure_cookie_attributes_are_preserved(secure_client, register_user):
    """The fix must not have relaxed the cookie's security attributes."""
    from app.config import get_settings

    _, login = _login(secure_client, register_user)
    set_cookie = login.headers.get("set-cookie", "").lower()

    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/api/v1/auth" in set_cookie
    if get_settings().refresh_cookie_secure:
        assert "secure" in set_cookie


# ---------------------------------------------------------------------------
# Fix B - logout revokes via the verified Bearer token
# ---------------------------------------------------------------------------

def test_logout_without_cookie_invalidates_access_token(client, register_user):
    """No refresh cookie: the Bearer token's `sid` must still revoke the session."""
    headers, _ = _login(client, register_user)
    client.cookies.clear()

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_logout_without_any_credentials_is_idempotent(client):
    """No cookie, no token: still a 200, and no session can be guessed."""
    first = client.post("/api/v1/auth/logout")
    second = client.post("/api/v1/auth/logout")
    assert first.status_code == second.status_code == 200


def test_repeated_logout_with_bearer_token_is_safe(secure_client, register_user):
    headers, _ = _login(secure_client, register_user)
    assert secure_client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    # Second call: the session is gone, the token is dead, still no error.
    assert secure_client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert secure_client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_logout_rejects_forged_bearer_token(client, register_user):
    """A forged token must not be able to revoke anything (signature checked)."""
    import jwt

    from app.config import get_settings

    headers, _ = _login(client, register_user)
    client.cookies.clear()

    settings = get_settings()
    real = jwt.decode(
        headers["Authorization"].removeprefix("Bearer "),
        settings.signing_key,
        algorithms=[settings.JWT_ALGORITHM],
        issuer=settings.JWT_ISSUER,
    )
    forged = jwt.encode(real, "not-the-real-signing-key-and-long-enough", algorithm="HS256")

    assert client.post(
        "/api/v1/auth/logout", headers={"Authorization": f"Bearer {forged}"}
    ).status_code == 200  # idempotent, but revokes nothing
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200


def test_logout_does_not_revoke_another_users_session(client, register_user):
    """A valid token may only end its *own* session family."""
    victim_headers, _ = _login(client, register_user, "candidate")
    attacker_headers, _ = _login(client, register_user, "candidate")

    # Attacker logs out with their own token while holding the victim's token.
    assert client.post("/api/v1/auth/logout", headers=attacker_headers).status_code == 200

    # The attacker's session dies; the victim's token still works.
    assert client.get("/api/v1/auth/me", headers=attacker_headers).status_code == 401
    assert client.get("/api/v1/auth/me", headers=victim_headers).status_code == 200


def test_logout_revokes_both_when_cookie_and_token_differ(secure_client, register_user):
    """Two sessions in play: neither may survive logout."""
    first_headers, first_login = _login(secure_client, register_user)
    first_cookie = first_login.cookies.get("hireflow_refresh")
    assert first_cookie

    # A second, independent session (new login -> new family), then put the
    # first session's cookie back into the jar.
    second_headers, _ = _login(secure_client, register_user)
    secure_client.cookies.set("hireflow_refresh", first_cookie)

    assert secure_client.post("/api/v1/auth/logout", headers=second_headers).status_code == 200

    assert secure_client.get("/api/v1/auth/me", headers=second_headers).status_code == 401
    assert secure_client.get("/api/v1/auth/me", headers=first_headers).status_code == 401
    assert secure_client.post("/api/v1/auth/refresh").status_code == 401


def test_refresh_still_rotates_and_rejects_replay(secure_client, register_user):
    """The rotation guarantees must be unaffected by the logout change."""
    _, login = _login(secure_client, register_user)
    original = login.cookies.get("hireflow_refresh")
    assert original

    rotated = secure_client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    assert rotated.cookies.get("hireflow_refresh") != original

    # Replay of the consumed token is treated as theft and kills the family.
    secure_client.cookies.set("hireflow_refresh", original)
    assert secure_client.post("/api/v1/auth/refresh").status_code == 401
    assert secure_client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_after_refresh_revokes_rotated_session(secure_client, register_user):
    """Logout must kill the family even after the token has rotated."""
    _, login = _login(secure_client, register_user)
    refreshed = secure_client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    rotated_headers = {"Authorization": f"Bearer {refreshed.json()['access_token']}"}

    assert secure_client.get("/api/v1/auth/me", headers=rotated_headers).status_code == 200
    secure_client.cookies.clear()  # force the Bearer-only path
    assert secure_client.post("/api/v1/auth/logout", headers=rotated_headers).status_code == 200
    assert secure_client.get("/api/v1/auth/me", headers=rotated_headers).status_code == 401
