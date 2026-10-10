import asyncio
import time

from fastapi import HTTPException
from sqlalchemy import select
from test_analysis import evidence
from test_api_security import fixture_repo

from app import worker
from app.models import Analysis, Finding
from app.models import TestRun as ExecutionRun


def test_retry_backoff_caps_attempts(authenticated, database, monkeypatch):
    db, factory = database
    repo = fixture_repo(db, authenticated.get("/api/me").json()["organization"]["id"])
    run = Analysis(org_id=repo.org_id, repo_id=repo.id, snapshot={})
    db.add(run)
    db.commit()

    async def unavailable(_):
        raise HTTPException(502, "Do not log upstream secrets")

    monkeypatch.setattr(worker, "SessionLocal", factory)
    monkeypatch.setattr(worker, "process", unavailable)
    for attempt in range(1, 4):
        asyncio.run(worker.tick())
        db.expire_all()
        db.refresh(run)
        assert run.attempts == attempt
        assert run.state == ("queued" if attempt < 3 else "failed")
        assert run.available_at > time.time()
        run.available_at = 0
        db.commit()
    assert "upstream secrets" not in run.error


def test_reviewed_test_verification_persists_exact_evidence(authenticated, database, monkeypatch):
    from app import runner_client

    db, _ = database
    repo = fixture_repo(db, authenticated.get("/api/me").json()["organization"]["id"])
    pulls = [{"number": n, "base_sha": "a" * 40, "head_sha": str(n) * 40} for n in (1, 2)]
    run = Analysis(
        org_id=repo.org_id,
        repo_id=repo.id,
        state="inconclusive",
        snapshot={"repository": repo.full_name, "pulls": pulls},
    )
    db.add(run)
    db.flush()
    finding = Finding(analysis_id=run.id, payload={"prs": [1, 2]})
    db.add(finding)
    db.commit()

    async def execute(repository, selected, source):
        assert repository == repo.full_name and selected == pulls and source == "import unittest"
        return evidence()

    monkeypatch.setattr(runner_client, "execute", execute)
    path = f"/api/findings/{finding.id}/verify"
    assert authenticated.post(path, json={"source": "import unittest", "reviewed": False}).status_code == 422
    response = authenticated.post(path, json={"source": "import unittest", "reviewed": True})
    assert response.status_code == 200 and response.json()["status"] == "reproduced"
    db.refresh(finding)
    assert finding.status == "reproduced"
    assert len(db.scalars(select(ExecutionRun)).all()) == 1
    run.state = "stale"
    db.commit()
    assert authenticated.post(path, json={"source": "import unittest", "reviewed": True}).status_code == 409


def test_github_connection_requires_app_configuration(authenticated, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "github_client_id", "")
    assert authenticated.get("/api/github/connect", follow_redirects=False).status_code == 503
    assert authenticated.get("/api/github/callback?code=untrusted&state=bad", follow_redirects=False).status_code == 403
