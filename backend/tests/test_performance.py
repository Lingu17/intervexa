"""Verify round-trip bounds without weakening session or indexing guarantees."""

import asyncio
import threading

from sqlalchemy import event, select
from test_intelligence import repo_index

from app.models import RepositoryIndex, Session


def test_slow_queue_polling_keeps_the_event_loop_responsive(monkeypatch):
    from app import worker

    released = threading.Event()

    def slow_claim(maintenance):
        assert maintenance is False
        assert released.wait(1), "Database polling blocked the event loop."
        return None

    monkeypatch.setattr(worker, "claim_job", slow_claim)

    async def scenario():
        asyncio.get_running_loop().call_later(0.01, released.set)
        await worker.tick(False)

    asyncio.run(scenario())


def test_workspace_bootstrap_has_two_reads_and_revocation_is_immediate(authenticated, database):
    db, _ = database
    statements = []

    def capture(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(db.bind, "before_cursor_execute", capture)
    try:
        response = authenticated.get("/api/me")
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "owner@example.com"
        assert response.json()["preferences"]["theme"] == "dark"
        assert len(statements) == 2
    finally:
        event.remove(db.bind, "before_cursor_execute", capture)
    db.delete(db.scalar(select(Session)))
    db.commit()
    assert authenticated.get("/api/me").status_code == 401


def test_parallel_index_is_bounded_ordered_and_enforces_actual_bytes(authenticated, database, monkeypatch):
    repo, _ = repo_index(authenticated, database)
    active = peak = 0

    class FakeGitHub:
        async def request(self, method, path, **kwargs):
            if "/commits/" in path:
                return {"sha": "b" * 40, "commit": {"tree": {"sha": "c" * 40}}}
            return {
                "tree": [
                    {"path": f"file{i:02}.py", "type": "blob", "mode": "100644", "size": 10}
                    for i in reversed(range(40))
                ]
            }

        async def text(self, name, path, sha):
            nonlocal active, peak
            assert sha == "b" * 40
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.002 if int(path[4:6]) % 2 else 0.005)
            active -= 1
            return "#" + "x" * 19999

    async def installation(_):
        return FakeGitHub()

    monkeypatch.setattr("app.intelligence.installation_client", installation)
    response = authenticated.post(f"/api/repositories/{repo.id}/index", json={"branch": "main"})
    assert response.status_code == 200
    assert peak == 4
    assert response.json()["coverage"]["source_bytes"] == 500000
    row = database[0].get(RepositoryIndex, repo.id)
    assert [file["path"] for file in row.files] == [f"file{i:02}.py" for i in range(25)]
