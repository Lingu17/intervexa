import json
import time
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import settings
from app.providers import provider_text
from app.social import verified_identity


@pytest.mark.parametrize(
    "override,valid",
    [
        ({}, True),
        ({"nonce": "wrong"}, False),
        ({"email_verified": False}, False),
        ({"aud": "other-client"}, False),
        ({"iss": "https://attacker.example"}, False),
        ({"exp": 1}, False),
    ],
)
def test_google_signed_claims_and_nonce(monkeypatch, override, valid):
    import asyncio

    monkeypatch.setattr(settings, "google_client_id", "expected-client")
    monkeypatch.setattr(settings, "google_client_secret", "test-secret")
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    public["kid"] = "fixture-key"
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "expected-client",
        "sub": "stable-subject",
        "email": "developer@gmail.com",
        "email_verified": True,
        "nonce": "expected-nonce",
        "exp": int(time.time()) + 120,
        "iat": int(time.time()),
    }
    encoded = jwt.encode({**claims, **override}, private, algorithm="RS256", headers={"kid": "fixture-key"})

    def transport(request):
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"id_token": encoded})
        return httpx.Response(200, json={"keys": [public]})

    original = httpx.AsyncClient
    monkeypatch.setattr(
        "app.social.httpx.AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(transport), **kwargs)
    )
    state = SimpleNamespace(origin="http://localhost:3000", nonce="expected-nonce")
    if valid:
        result = asyncio.run(verified_identity("google", "fixture-code", state))
        assert result[0:2] == ("stable-subject", "developer@gmail.com")
    else:
        with pytest.raises((ValueError, jwt.PyJWTError)):
            asyncio.run(verified_identity("google", "fixture-code", state))


@pytest.mark.parametrize(
    "data,provider",
    [
        ({"choices": []}, "openrouter"),
        ({"choices": [{"message": {"content": None}}]}, "openrouter"),
        ({"output": [None]}, "openai"),
        ({"output": []}, "openai"),
    ],
)
def test_malformed_provider_output_is_actionable(data, provider):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        provider_text(data, provider)
    assert exc.value.status_code == 502


def test_rag_rejects_invented_citations(authenticated, database, monkeypatch):
    from test_intelligence import repo_index

    repo, _ = repo_index(authenticated, database)

    async def upstream(*args, **kwargs):
        return {"choices": [{"message": {"content": "This function returns a token [invented.py:100]."}}]}

    monkeypatch.setattr("app.intelligence.request_provider", upstream)
    body = {
        "provider": "openrouter",
        "api_key": "ephemeral-fixture-key",
        "model": "fixture",
        "question": "create_session",
        "consent": True,
    }
    response = authenticated.post(f"/api/repositories/{repo.id}/question", json=body)
    assert response.status_code == 502

    async def grounded(*args, **kwargs):
        return {
            "choices": [{"message": {"content": "create_session returns a token dictionary [auth.py:3]."}}],
            "usage": {"total_tokens": 42},
        }

    monkeypatch.setattr("app.intelligence.request_provider", grounded)
    response = authenticated.post(f"/api/repositories/{repo.id}/question", json=body)
    assert response.status_code == 200
    assert response.json()["sources"][0]["sha"] == "a" * 40
    assert response.json()["usage"]["total_tokens"] == 42
