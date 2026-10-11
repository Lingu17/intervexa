import time

import httpx
import pytest
from sqlalchemy import select

from app.config import settings
from app.contact_email import deliver_one
from app.models import ContactSubmission


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "test-secret")
    monkeypatch.setattr(settings, "contact_email_to", "owner@example.com")


def queued(database):
    db, factory = database
    row = ContactSubmission(
        name="Visitor",
        email="visitor@example.com",
        topic="support",
        message="A reproducible question about the product.",
        email_state="queued",
    )
    db.add(row)
    db.commit()
    return db, factory, row


def test_notification_commit_and_public_configuration(client, database, enabled):
    assert client.get("/api/contact/config").json() == {"email_notifications": True}
    result = client.post(
        "/api/contact",
        headers={"Origin": "http://localhost:3000"},
        json={
            "name": "Visitor",
            "email": "visitor@example.com",
            "topic": "support",
            "message": "A reproducible question about the product.",
        },
    )
    assert result.status_code == 201
    assert result.json()["notification"] == "queued"
    assert "queued" in result.json()["message"]
    assert "delivered" not in result.json()["message"]
    assert database[0].scalar(select(ContactSubmission)).email_state == "queued"


def test_acceptance_fixed_recipient_reply_to_and_no_duplicate(database, enabled):
    db, factory, row = queued(database)
    requests = []

    def send(request):
        import json

        requests.append(request)
        payload = json.loads(request.content)
        assert payload["to"] == ["owner@example.com"]
        assert payload["reply_to"] == "visitor@example.com"
        assert "html" not in payload
        assert request.headers["Idempotency-Key"] == f"contact/{row.id}"
        return httpx.Response(200, json={"id": "email-123"})

    transport = httpx.MockTransport(send)
    deliver_one(factory, transport)
    deliver_one(factory, transport)
    db.refresh(row)
    assert row.email_state == "accepted"
    assert row.email_provider_id == "email-123"
    assert len(requests) == 1


@pytest.mark.parametrize("code", [429, 500, 503])
def test_retry_backoff_and_cap(database, enabled, code):
    db, factory, row = queued(database)
    now = time.time()
    requests = []

    def fail(request):
        requests.append(request)
        return httpx.Response(code, json={"message": "secret provider error"})

    transport = httpx.MockTransport(fail)
    deliver_one(factory, transport, now)
    deliver_one(factory, transport, now + 1)
    db.refresh(row)
    assert row.email_state == "queued"
    assert row.email_attempts == 1
    assert len(requests) == 1
    for _attempt in range(4):
        db.refresh(row)
        now = row.email_available_at
        deliver_one(factory, transport, now)
    db.refresh(row)
    assert row.email_state == "failed"
    assert row.email_attempts == 5
    assert len({r.headers["Idempotency-Key"] for r in requests}) == 1


def test_permanent_rejection_not_retried(database, enabled):
    db, factory, row = queued(database)
    deliver_one(factory, httpx.MockTransport(lambda _: httpx.Response(403)))
    db.refresh(row)
    assert row.email_state == "failed"
    assert row.email_provider_id is None


def test_expired_lease_recovers_same_id(database, enabled):
    db, factory, row = queued(database)
    row.email_state = "sending"
    row.email_available_at = time.time() - 1
    row.email_attempts = 1
    db.commit()
    deliver_one(factory, httpx.MockTransport(lambda _: httpx.Response(200, json={"id": "same-email"})))
    db.refresh(row)
    assert row.email_state == "accepted"
    assert row.email_attempts == 2


def test_disabled_preserves_submission(database, monkeypatch):
    db, factory, row = queued(database)
    monkeypatch.setattr(settings, "resend_api_key", "")
    deliver_one(factory, httpx.MockTransport(lambda _: pytest.fail("must not send")))
    db.refresh(row)
    assert row.email_state == "queued"
    assert row.email_attempts == 0


def test_timeout_and_malformed_success_are_retryable(database, enabled):
    db, factory, row = queued(database)

    def timeout(_):
        raise httpx.ReadTimeout("private provider data")

    deliver_one(factory, httpx.MockTransport(timeout))
    db.refresh(row)
    assert row.email_state == "queued"
    deliver_one(factory, httpx.MockTransport(lambda _: httpx.Response(200, json={})), row.email_available_at)
    db.refresh(row)
    assert row.email_state == "queued"
    assert row.email_attempts == 2
