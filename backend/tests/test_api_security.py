import hashlib
import hmac
import json

import pytest
from sqlalchemy import select

from app.config import settings
from app.models import Analysis, Delivery, Finding, Installation, ProviderPreference, PullRequest, Repository


def fixture_repo(db, org):
    installation = Installation(id=123, org_id=org, account="example")
    db.add(installation)
    db.flush()
    repo = Repository(org_id=org, installation_id=123, full_name="example/repo", default_branch="main")
    db.add(repo)
    db.flush()
    for number in (1, 2):
        db.add(
            PullRequest(
                repo_id=repo.id,
                number=number,
                title=f"Change {number}",
                base_sha="a" * 40,
                head_sha=str(number) * 40,
                files=[
                    {
                        "filename": "auth.py",
                        "patch": "+def login(session):\n+ return session.token",
                        "status": "modified",
                    }
                ],
            )
        )
    db.commit()
    return repo


def test_auth_csrf_logout_and_no_plaintext_password(authenticated, database):
    client = authenticated
    me = client.get("/api/me")
    assert me.status_code == 200
    assert "httponly" in str(client.cookies).lower() or client.cookies.get("intervexa_session")
    db, _ = database
    from app.models import Session, User

    user = db.scalar(select(User))
    assert user.password.startswith("$argon2")
    assert db.scalar(select(Session)).id != client.cookies.get("intervexa_session")
    assert client.post("/api/auth/logout", headers={"X-CSRF-Token": "wrong"}).status_code == 403
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/me").status_code == 401


def test_origin_request_limits_and_secret_validation(client):
    assert client.post("/api/auth/register", json={}).status_code == 403
    assert (
        client.post(
            "/api/auth/register", headers={"Origin": "http://localhost:3000"}, content="x" * 1_000_001
        ).status_code
        == 413
    )
    for _ in range(10):
        client.post(
            "/api/auth/login",
            headers={"Origin": "http://localhost:3000"},
            json={"email": "none@example.com", "password": "invalid-passphrase"},
        )
    assert (
        client.post(
            "/api/auth/login",
            headers={"Origin": "http://localhost:3000"},
            json={"email": "none@example.com", "password": "invalid-passphrase"},
        ).status_code
        == 429
    )


def test_cross_tenant_access(authenticated, database):
    client = authenticated
    db, _ = database
    org = client.get("/api/me").json()["organization"]["id"]
    repo = fixture_repo(db, org)
    run = Analysis(org_id=org, repo_id=repo.id, snapshot={"repository": repo.full_name, "pulls": []})
    db.add(run)
    db.flush()
    finding = Finding(analysis_id=run.id, payload={})
    db.add(finding)
    db.commit()
    first_cookies = client.cookies.get("intervexa_session")
    second = client.post(
        "/api/auth/register",
        json={"email": "other@example.com", "password": "another-secure-passphrase", "name": "Other"},
    )
    client.headers["X-CSRF-Token"] = second.json()["csrf"]
    assert client.cookies.get("intervexa_session") != first_cookies
    for path in (f"/repositories/{repo.id}", f"/analyses/{run.id}", f"/findings/{finding.id}"):
        assert client.get("/api" + path).status_code == 404
    assert client.post(f"/api/repositories/{repo.id}/analyses").status_code == 404
    assert client.get("/api/repositories").json() == []
    assert client.get("/api/findings").json() == []


def test_snapshot_deduplication_and_cancellation(authenticated, database):
    db, _ = database
    org = authenticated.get("/api/me").json()["organization"]["id"]
    repo = fixture_repo(db, org)
    first = authenticated.post(f"/api/repositories/{repo.id}/analyses").json()
    second = authenticated.post(f"/api/repositories/{repo.id}/analyses").json()
    assert first["id"] == second["id"] and second["deduplicated"]
    run = db.get(Analysis, first["id"])
    assert run.snapshot["pulls"][0]["head_sha"] == "1" * 40
    assert authenticated.post(f"/api/analyses/{run.id}/cancel").status_code == 200
    assert db.get(Analysis, run.id).state == "cancelled"
    assert authenticated.post(f"/api/analyses/{run.id}/cancel").status_code == 409


def test_webhook_signature_dedup_and_stale(authenticated, database, monkeypatch):
    monkeypatch.setattr(settings, "github_webhook_secret", "webhook-test-secret")
    db, _ = database
    repo = fixture_repo(db, authenticated.get("/api/me").json()["organization"]["id"])
    run = Analysis(org_id=repo.org_id, repo_id=repo.id, state="completed", snapshot={})
    db.add(run)
    db.commit()
    payload = json.dumps({"installation": {"id": 123}, "repository": {"full_name": "example/repo"}}).encode()
    headers = {"X-GitHub-Delivery": "delivery-1", "X-GitHub-Event": "pull_request", "X-Hub-Signature-256": "bad"}
    assert authenticated.post("/api/github/webhook", content=payload, headers=headers).status_code == 403
    headers["X-Hub-Signature-256"] = "sha256=" + hmac.new(b"webhook-test-secret", payload, hashlib.sha256).hexdigest()
    assert authenticated.post("/api/github/webhook", content=payload, headers=headers).json()["accepted"]
    assert db.get(Analysis, run.id).state == "stale"
    assert len(db.scalars(select(Analysis).where(Analysis.state == "queued")).all()) == 1
    assert authenticated.post("/api/github/webhook", content=payload, headers=headers).json()["duplicate"]
    assert len(db.scalars(select(Delivery)).all()) == 1


def test_keys_never_echoed_or_persisted(authenticated, database):
    secret = "sensitive-credential-do-not-expose"
    response = authenticated.post("/api/providers/test", json={"provider": "invalid", "api_key": secret})
    assert response.status_code == 422 and secret not in response.text
    authenticated.post(
        "/api/providers/preference", json={"provider": "openai", "model": "selected-model", "max_tokens": 800}
    )
    db, _ = database
    row = db.scalar(select(ProviderPreference))
    assert not hasattr(row, "api_key")
    assert authenticated.get("/api/providers/preference").json()["model"] == "selected-model"


@pytest.mark.parametrize(
    "path",
    [
        "/api/repositories",
        "/api/analyses",
        "/api/findings",
        "/api/settings/audit",
        "/api/providers/preference",
        "/api/github/available",
    ],
)
def test_protected_routes(client, path):
    assert client.get(path).status_code == 401
