import asyncio
import os
import subprocess
import sys
from pathlib import Path

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from test_api_security import fixture_repo

from app.github import GitHub, ingest
from app.models import Analysis, CodeEntity, Finding
from app.providers import GenerateInput, ProviderInput, generate_test, validate_key


def mock_http(monkeypatch, handler):
    original = httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return original(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)


@pytest.mark.parametrize("provider", ["openai", "openrouter"])
def test_provider_real_validation_protocol_mocked(provider, monkeypatch, caplog):
    seen = []

    def handler(request):
        seen.append(request.url.path)
        assert request.headers["Authorization"] == "Bearer test-key-private"
        if request.url.path.endswith("/key"):
            return httpx.Response(200, json={"data": {"label": "test"}})
        return httpx.Response(200, json={"data": [{"id": "chosen-model"}]})

    mock_http(monkeypatch, handler)
    data = asyncio.run(validate_key(ProviderInput(provider=provider, api_key="test-key-private")))
    assert data["connected"] and data["models"][0]["id"] == "chosen-model"
    assert seen == (["/api/v1/key", "/api/v1/models"] if provider == "openrouter" else ["/v1/models"])
    assert "test-key-private" not in caplog.text


@pytest.mark.parametrize("status", [401, 402, 403, 404, 429, 500])
def test_provider_error_redaction(status, monkeypatch):
    mock_http(monkeypatch, lambda request: httpx.Response(status, json={"error": "test-key-private"}))
    with pytest.raises(HTTPException) as error:
        asyncio.run(validate_key(ProviderInput(provider="openai", api_key="test-key-private")))
    assert "test-key-private" not in str(error.value.detail)
    assert error.value.status_code == status if status != 500 else error.value.status_code == 502


def test_generation_consent_syntax_and_operations(monkeypatch):
    body = GenerateInput(provider="openai", api_key="test-key-private", model="chosen-model", consent=False)
    with pytest.raises(HTTPException):
        asyncio.run(generate_test(body, {}, {}))
    body.consent = True
    source = (
        "import unittest\nclass Regression(unittest.TestCase):\n def test_contract(self):\n  self.assertEqual(1, 1)"
    )

    def handler(request):
        assert request.url.path == "/v1/responses"
        import json

        payload = json.loads(request.content)
        assert payload["store"] is False
        assert json.loads(payload["input"])["framework"] == "Python unittest"
        return httpx.Response(
            200,
            json={"output": [{"content": [{"type": "output_text", "text": source}]}], "usage": {"output_tokens": 50}},
        )

    mock_http(monkeypatch, handler)
    generated = asyncio.run(generate_test(body, {}, {}))
    assert generated["syntax_valid"] and not generated["executed"]


def test_github_ingestion_detects_moving_heads(monkeypatch):
    def handler(request):
        if request.url.path.endswith("/files"):
            return httpx.Response(
                200, json=[{"filename": "auth.py", "status": "modified", "changes": 1, "patch": "+token"}]
            )
        if request.url.path.endswith("/pulls"):
            return httpx.Response(
                200, json=[{"number": 1, "title": "Auth", "base": {"sha": "a" * 40}, "head": {"sha": "b" * 40}}]
            )
        return httpx.Response(200, json={"base": {"sha": "a" * 40}, "head": {"sha": "c" * 40}})

    mock_http(monkeypatch, handler)
    with pytest.raises(HTTPException) as error:
        asyncio.run(ingest(GitHub("temporary-test-token"), "example/repo"))
    assert error.value.status_code == 409


def test_worker_end_to_end_static_findings(authenticated, database, monkeypatch):
    from app import worker

    db, factory = database
    repo = fixture_repo(db, authenticated.get("/api/me").json()["organization"]["id"])
    response = authenticated.post(f"/api/repositories/{repo.id}/analyses").json()
    run = db.get(Analysis, response["id"])
    run.state = "collecting"
    db.commit()

    class Client:
        async def request(self, method, path, **kwargs):
            if "/git/commits/" in path:
                return {"tree": {"sha": "d" * 40}}
            if "/git/trees/" in path:
                return {"tree": [{"path": "tests/test_login.py", "type": "blob"}], "truncated": False}
            n = 1 if path.endswith("/1") else 2
            return {"base": {"sha": "a" * 40}, "head": {"sha": str(n) * 40}, "state": "open"}

        async def text(self, repo, path, sha):
            if path.startswith("tests/"):
                return (
                    "import unittest\nclass Login(unittest.TestCase):\n def test_login(self):\n  self.assertTrue(True)"
                )
            return (
                'def login(session):\n return {"token": session}\n'
                if sha == "a" * 40
                else 'def login(session, scope):\n return {"session": session}\n'
            )

    async def client(_):
        return Client()

    async def check(*args, **kwargs):
        return {"id": 1}

    monkeypatch.setattr(worker, "SessionLocal", factory)
    monkeypatch.setattr(worker, "installation_client", client)
    monkeypatch.setattr(worker, "publish_check", check)
    asyncio.run(worker.process(run.id))
    db.expire_all()
    assert db.get(Analysis, run.id).state == "inconclusive"
    finding = db.scalar(select(Finding).where(Finding.analysis_id == run.id))
    assert finding.status == "suspected"
    assert finding.payload["contract_changes"]
    assert len(db.scalars(select(CodeEntity)).all()) > 0
    asyncio.run(worker.process(run.id))
    assert len(db.scalars(select(Finding)).all()) == 1


def test_migration_up_down_up(tmp_path):
    env = {**os.environ, "DATABASE_URL": "sqlite:///" + str(tmp_path / "migration.db"), "PYTHONPATH": str(Path.cwd())}
    for revision in ["head", "base", "head"]:
        command = "downgrade" if revision == "base" else "upgrade"
        result = subprocess.run(
            [sys.executable, "-m", "alembic", command, revision], env=env, capture_output=True, text=True
        )
        assert result.returncode == 0, result.stderr
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from sqlalchemy import create_engine

    from app.db import Base

    engine = create_engine(env["DATABASE_URL"])
    with engine.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
        assert differences == [], differences
    engine.dispose()


def test_preferences_migration_preserves_existing_accounts_and_defaults(tmp_path):
    import sqlite3

    path = tmp_path / "existing.db"
    env = {**os.environ, "DATABASE_URL": "sqlite:///" + str(path), "PYTHONPATH": str(Path.cwd())}
    first = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "0003_intelligence"], env=env, capture_output=True, text=True
    )
    assert first.returncode == 0, first.stderr
    with sqlite3.connect(path) as db:
        db.execute(
            "INSERT INTO users (id,email,name,password,created_at) VALUES (?,?,?,?,?)",
            ("existing-user", "existing@gmail.com", "Existing", "existing-hash", 1),
        )
        db.execute("INSERT INTO organizations (id,name) VALUES (?,?)", ("existing-workspace", "Existing workspace"))
        db.execute(
            "INSERT INTO memberships (id,user_id,org_id,role) VALUES (?,?,?,?)",
            ("existing-membership", "existing-user", "existing-workspace", "owner"),
        )
        db.execute(
            "INSERT INTO provider_preferences (user_id,provider,model,max_tokens) VALUES (?,?,?,?)",
            ("existing-user", "openai", "existing-model", 1234),
        )
    migrated = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"], env=env, capture_output=True, text=True
    )
    assert migrated.returncode == 0, migrated.stderr
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT email,password FROM users").fetchone() == ("existing@gmail.com", "existing-hash")
        assert db.execute("SELECT provider,model,max_tokens,org_id FROM provider_preferences").fetchone() == (
            "openai",
            "existing-model",
            1234,
            "existing-workspace",
        )
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
