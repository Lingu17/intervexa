import time
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from test_api_security import fixture_repo

from app.config import Settings, settings
from app.intelligence import graph, parse_file, retrieve
from app.models import ContactSubmission, OAuthState, RepositoryIndex, SocialIdentity, User, WorkspacePreference
from app.social import resolve_identity


def repo_index(client, database):
    db, _ = database
    org = client.get("/api/me").json()["organization"]["id"]
    repo = fixture_repo(db, org)
    files = [
        parse_file("auth.py", "from store import save\ndef create_session():\n    return {'token': save()}\n"),
        parse_file("store.py", "def save():\n    return 'abc'\n"),
    ]
    row = RepositoryIndex(repo_id=repo.id, sha="a" * 40, branch="main", files=files, coverage={"indexed_files": 2})
    db.add(row)
    db.commit()
    return repo, row


@pytest.mark.parametrize("email", ["developer@gmail.com", "student@outlook.com"])
def test_personal_signup_loopback_alias(client, email):
    result = client.post(
        "/api/auth/register",
        headers={"Origin": "http://127.0.0.1:3000"},
        json={"email": email, "name": "Developer", "password": "personal-secure-password"},
    )
    assert result.status_code == 200
    assert client.get("/api/me").json()["user"]["email"] == email
    assert (
        client.post(
            "/api/auth/logout", headers={"Origin": "http://127.0.0.1:3000", "X-CSRF-Token": "wrong"}
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "origin", ["http://localhost:3000.evil.test", "http://localhost:3001", "null", "https://attacker.example"]
)
def test_origin_denied(client, origin):
    assert client.post("/api/contact", headers={"Origin": origin}, json={}).status_code == 403


def test_production_origins_do_not_inherit_localhost():
    config = Settings(
        environment="production", app_origin="https://intervexa.example", allowed_origins="https://preview.example"
    )
    assert config.origins == ["https://intervexa.example", "https://preview.example"]


def contact_payload():
    return {
        "name": "Developer",
        "email": "dev@gmail.com",
        "topic": "feedback",
        "message": "Please add Python call resolution for this workflow.",
        "website": "",
    }


def test_contact_persistence_validation_and_rate(client, database):
    headers = {"Origin": "http://localhost:3000"}
    body = contact_payload()
    result = client.post("/api/contact", headers=headers, json=body)
    assert result.status_code == 201
    assert result.json()["status"] == "recorded"
    db, _ = database
    assert db.scalar(select(ContactSubmission)).email == body["email"]
    assert client.post("/api/contact", headers=headers, json={**body, "website": "spam"}).status_code == 422
    assert client.post("/api/contact", headers=headers, json={**body, "message": " " * 20}).status_code == 422
    assert client.post("/api/contact", headers=headers, json=body).status_code == 429


def test_contact_commit_failure_is_not_success(client, database, monkeypatch):
    db, _ = database

    def fail():
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(db, "commit", fail)
    response = client.post("/api/contact", headers={"Origin": "http://localhost:3000"}, json=contact_payload())
    assert response.status_code == 500
    assert "recorded" not in response.text


def test_pinned_file_search_graph_and_coverage(authenticated, database):
    repo, index = repo_index(authenticated, database)
    root = "/api/repositories/" + repo.id
    overview = authenticated.get(root + "/intelligence").json()
    assert overview["sha"] == "a" * 40
    assert all("source" not in f for f in overview["files"])
    assert {"source": "auth.py", "target": "store.py", "kind": "import", "line": 1} in overview["graph"]["edges"]
    file = authenticated.get(root + "/file", params={"path": "auth.py"}).json()
    assert file["symbols"][0]["name"] == "create_session"
    assert file["sha"] == "a" * 40
    assert authenticated.get(root + "/file", params={"path": "../../.env"}).status_code == 404
    search = authenticated.get(root + "/search?q=create_session").json()
    assert search["results"][0]["path"] == "auth.py"
    assert search["results"][0]["line"] >= 1
    assert authenticated.get(root + "/search?q=unseen_identifier").json()["results"] == []
    assert graph(index)["nodes"][0]["kind"] == "repository"
    assert retrieve(index, "") == []


def test_index_build_pins_commit_and_excludes_secret_files(authenticated, database, monkeypatch):
    repo, _ = repo_index(authenticated, database)
    seen = []

    class FakeGitHub:
        async def request(self, method, path, **kwargs):
            if "/commits/" in path:
                return {"sha": "b" * 40, "commit": {"tree": {"sha": "c" * 40}}}
            return {
                "tree": [
                    {"path": path, "type": "blob", "mode": mode, "size": 30}
                    for path, mode in [("main.py", "100644"), (".env.py", "100644"), ("link.py", "120000")]
                ],
                "truncated": False,
            }

        async def text(self, name, path, sha):
            seen.append((path, sha))
            return "def main():\n    return True\n"

    async def fake_installation(_):
        return FakeGitHub()

    monkeypatch.setattr("app.intelligence.installation_client", fake_installation)
    response = authenticated.post(f"/api/repositories/{repo.id}/index", json={"branch": "feature/one"})
    assert response.status_code == 200, response.text
    assert seen == [("main.py", "b" * 40)]
    assert response.json()["coverage"]["indexed_files"] == 1


def test_new_endpoints_enforce_tenant_boundaries(authenticated, database):
    repo, _ = repo_index(authenticated, database)
    first_id = authenticated.get("/api/me").json()["user"]["id"]
    first_org = authenticated.get("/api/me").json()["organization"]["id"]
    assert authenticated.patch("/api/settings/preferences", json={"theme": "light"}).status_code == 200
    assert (
        authenticated.post(
            "/api/providers/preference", json={"provider": "openai", "model": "owner-model", "max_tokens": 1000}
        ).status_code
        == 200
    )
    registered = authenticated.post(
        "/api/auth/register",
        json={"name": "Other", "email": "other@outlook.com", "password": "other-personal-passphrase"},
    )
    authenticated.headers["X-CSRF-Token"] = registered.json()["csrf"]
    assert authenticated.get("/api/providers/preference").json() is None
    assert authenticated.get("/api/me").json()["preferences"]["theme"] == "dark"
    assert authenticated.patch("/api/settings/preferences", json={"theme": "dark"}).status_code == 200
    assert database[0].get(WorkspacePreference, first_org).theme == "light"
    root = "/api/repositories/" + repo.id
    for path in ("/intelligence", "/file?path=auth.py", "/search?q=auth", "/branches"):
        assert authenticated.get(root + path).status_code == 404
    for path, body in [
        ("/index", {"branch": "main"}),
        ("/embeddings", {"provider": "openai", "api_key": "ephemeral-test-key", "consent": True}),
    ]:
        assert authenticated.post(root + path, json=body).status_code == 404
    assert authenticated.delete("/api/repositories/" + repo.id).status_code == 404
    assert authenticated.get("/api/settings/export").json()["repositories"] == []
    assert (
        authenticated.patch("/api/settings/profile", json={"name": "Updated", "workspace_name": "Personal"}).status_code
        == 200
    )
    assert database[0].get(User, first_id).name == "Owner"


def test_embedding_consent_storage_and_query(authenticated, database, monkeypatch):
    repo, index = repo_index(authenticated, database)
    calls = []

    async def fake(body, path, payload=None):
        calls.append(payload)
        return {
            "data": [{"index": i, "embedding": [1.0] + [0.0] * 255} for i in range(len(payload["input"]))],
            "usage": {"total_tokens": 30},
        }

    monkeypatch.setattr("app.intelligence.request_provider", fake)
    body = {"provider": "openai", "api_key": "ephemeral-test-key", "consent": False}
    root = f"/api/repositories/{repo.id}"
    assert authenticated.post(root + "/embeddings", json=body).status_code == 422
    assert calls == []
    body["consent"] = True
    assert authenticated.post(root + "/embeddings", json=body).status_code == 200
    assert index.vectors["model"] == "text-embedding-3-small"
    assert "ephemeral-test-key" not in str(index.vectors)
    result = authenticated.post(root + "/semantic-search", json={**body, "query": "session producer"})
    assert result.status_code == 200
    assert result.json()["results"][0]["sha"] == "a" * 40


def test_question_insufficient_evidence_never_calls_provider(authenticated, database, monkeypatch):
    repo, _ = repo_index(authenticated, database)

    async def fail(*args):
        raise AssertionError("Provider must not be called")

    monkeypatch.setattr("app.intelligence.request_provider", fail)
    result = authenticated.post(
        f"/api/repositories/{repo.id}/question",
        json={
            "provider": "openai",
            "api_key": "ephemeral-test-key",
            "model": "test-model",
            "consent": True,
            "question": "unseen_identifier",
        },
    )
    assert result.status_code == 200
    assert result.json()["generated"] is False


def test_selected_changes_validation(authenticated, database):
    repo, _ = repo_index(authenticated, database)
    path = f"/api/repositories/{repo.id}/analyses"
    assert authenticated.post(path, json={"pull_numbers": [1, 1]}).status_code == 422
    assert authenticated.post(path, json={"pull_numbers": [1, 3]}).status_code == 422
    assert authenticated.post(path, json={"pull_numbers": [1]}).status_code == 422
    result = authenticated.post(path, json={"pull_numbers": [1, 2]})
    assert result.status_code == 200


def test_oauth_unconfigured_and_state_origin_validation(client, monkeypatch):
    assert client.get("/api/auth/oauth/google").status_code == 503
    monkeypatch.setattr(settings, "google_client_id", "fixture-client")
    monkeypatch.setattr(settings, "google_client_secret", "fixture-secret")
    assert client.get("/api/auth/oauth/google?origin=https://evil.example").status_code == 403
    response = client.get("/api/auth/oauth/google", follow_redirects=False)
    assert response.status_code == 302
    params = parse_qs(urlsplit(response.headers["location"]).query)
    assert params["scope"] == ["openid email profile"]
    assert params["nonce"]
    assert client.get("/api/auth/oauth/google/callback?state=wrong&code=fixture").status_code == 403


def test_oauth_callback_cookie_replay_and_existing_email(authenticated, database, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "fixture-client")
    monkeypatch.setattr(settings, "google_client_secret", "fixture-secret")

    async def identity(*args):
        return "google-subject", "owner@example.com", "Owner"

    monkeypatch.setattr("app.social.verified_identity", identity)
    response = authenticated.get("/api/auth/oauth/google", follow_redirects=False)
    state = parse_qs(urlsplit(response.headers["location"]).query)["state"][0]
    callback = f"/api/auth/oauth/google/callback?state={state}&code=fixture"
    assert authenticated.get(callback, follow_redirects=False).status_code == 409
    assert authenticated.get(callback, follow_redirects=False).status_code == 403
    assert database[0].scalar(select(SocialIdentity)) is None
    response = authenticated.get("/api/auth/oauth/google?link=true", follow_redirects=False)
    state = parse_qs(urlsplit(response.headers["location"]).query)["state"][0]
    result = authenticated.get(f"/api/auth/oauth/google/callback?state={state}&code=fixture", follow_redirects=False)
    assert result.status_code == 302
    assert database[0].scalar(select(SocialIdentity)).provider == "google"
    assert database[0].scalars(select(User)).all().__len__() == 1


def test_expired_oauth_and_email_collision(authenticated, database):
    db, _ = database
    user = db.scalar(select(User))
    with pytest.raises(HTTPException, match="409"):
        resolve_identity(db, "github", "new-sub", user.email, user.name)
    from app.security import token_hash

    db.add(
        OAuthState(
            id=token_hash("old"), provider="github", nonce="nonce", origin=settings.app_origin, expires=time.time() - 1
        )
    )
    db.commit()
    assert authenticated.get("/api/auth/oauth/github/callback?state=old&code=test").status_code == 403


def test_account_export_and_confirmed_delete(authenticated, database):
    repo, _ = repo_index(authenticated, database)
    assert authenticated.get("/api/settings/export").json()["repositories"][0]["name"] == repo.full_name
    assert authenticated.request("DELETE", "/api/settings/account", json={"confirmation": "wrong"}).status_code == 422
    response = authenticated.request("DELETE", "/api/settings/account", json={"confirmation": "owner@example.com"})
    assert response.status_code == 200
    assert authenticated.get("/api/me").status_code == 401
