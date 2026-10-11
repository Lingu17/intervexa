import hashlib
import secrets
import time
from collections import defaultdict, deque

from argon2 import PasswordHasher
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from .db import get_db
from .models import Audit, Membership, Session, User

hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
attempts: dict[str, deque] = defaultdict(deque)


def limit(key: str, count=20, window=60):
    now = time.monotonic()
    bucket = attempts[key]
    while bucket and bucket[0] < now - window:
        bucket.popleft()
    if len(bucket) >= count:
        raise HTTPException(429, "Request limit reached. Try again later.", headers={"Retry-After": str(window)})
    bucket.append(now)
    if len(attempts) > 10000:
        for old in list(attempts)[:1000]:
            if not attempts[old] or attempts[old][-1] < now - window:
                del attempts[old]


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def principal(request: Request, db: DBSession = Depends(get_db)):
    token = request.cookies.get("intervexa_session", "")
    if not token:
        raise HTTPException(401, "Sign in to continue.")
    # One round trip instead of separate session, user and membership reads.
    row = db.execute(
        select(Session, User, Membership)
        .join(User, User.id == Session.user_id)
        .outerjoin(Membership, Membership.user_id == User.id)
        .where(Session.id == token_hash(token))
    ).first()
    if not row or row[0].expires < time.time():
        raise HTTPException(401, "Sign in to continue.")
    session, user, member = row
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        supplied = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(session.csrf, supplied):
            raise HTTPException(403, "Session verification failed. Refresh and try again.")
    if not member:
        raise HTTPException(403, "Workspace membership required.")
    return user, member.org_id, session


def audit(db, org, actor, action):
    db.add(Audit(org_id=org, actor=actor, action=action))
