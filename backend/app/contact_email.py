"""Bounded, durable owner notifications. Provider acceptance is not inbox delivery."""

import time

import httpx
from sqlalchemy import select, update

from .config import settings
from .db import SessionLocal
from .models import ContactSubmission


def deliver_one(factory=SessionLocal, transport=None, now=None):
    if not settings.contact_email_enabled:
        return
    now = time.time() if now is None else now
    with factory() as db:
        # Claims expire after 60 seconds, including when the process stops mid-send.
        row = db.scalar(
            select(ContactSubmission)
            .where(
                ContactSubmission.email_state.in_(["queued", "sending"]),
                ContactSubmission.email_available_at <= now,
            )
            .order_by(ContactSubmission.created_at)
            .limit(1)
        )
        if not row:
            return
        if row.email_attempts >= 5 or row.created_at < now - 3600:
            row.email_state = "failed"
            db.commit()
            return
        claimed = db.execute(
            update(ContactSubmission)
            .where(
                ContactSubmission.id == row.id,
                ContactSubmission.email_state.in_(["queued", "sending"]),
                ContactSubmission.email_available_at <= now,
            )
            .values(
                email_state="sending", email_available_at=now + 60, email_attempts=ContactSubmission.email_attempts + 1
            )
        ).rowcount
        db.commit()
        if not claimed:
            return
        payload = {
            "from": settings.contact_email_from,
            "to": [settings.contact_email_to],
            "reply_to": row.email,
            "subject": f"Intervexa contact: {row.topic}",
            "text": f"Submission: {row.id}\nName: {row.name}\nEmail: {row.email}\nTopic: {row.topic}\n\n{row.message}",
        }
        retry = False
        provider_id = None
        try:
            with httpx.Client(timeout=10, transport=transport) as client:
                response = client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key}",
                        "Idempotency-Key": f"contact/{row.id}",
                    },
                    json=payload,
                )
            retry = response.status_code in (408, 409, 429) or response.status_code >= 500
            if response.is_success:
                data = response.json()
                provider_id = data.get("id") if isinstance(data, dict) else None
                if not isinstance(provider_id, str) or not 0 < len(provider_id) <= 100:
                    provider_id = None
                    retry = True
        except (httpx.HTTPError, ValueError):
            retry = True
        # Never persist/log response bodies, recipient content or credentials.
        row.email_provider_id = provider_id
        row.email_state = "accepted" if provider_id else "queued" if retry and row.email_attempts < 5 else "failed"
        row.email_available_at = now + min(600, 30 * 2**row.email_attempts)
        db.commit()
