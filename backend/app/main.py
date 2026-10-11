import asyncio
import contextlib
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
from contextlib import asynccontextmanager
from typing import Literal
from urllib.parse import urlencode

import httpx
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from .config import settings
from .db import engine, get_db
from .github import GitHub, ingest, installation_client, publish_check
from .intelligence import router as intelligence_router
from .models import (
    Analysis,
    Audit,
    Delivery,
    Finding,
    Installation,
    Membership,
    Organization,
    ProviderPreference,
    PullRequest,
    Repository,
    RepositoryIndex,
    Session,
    TestRun,
    User,
    WorkspacePreference,
)
from .providers import GenerateInput, ProviderInput, generate_test, validate_key
from .security import audit, hasher, limit, principal, token_hash
from .social import router as social_router

log = logging.getLogger("intervexa")
logging.basicConfig(level=logging.INFO, format="%(message)s")


@asynccontextmanager
async def lifespan(app):
    if settings.environment == "production":
        if (
            not settings.app_origin.startswith("https://")
            or len(settings.session_secret) < 32
            or settings.database_url.startswith("sqlite")
        ):
            raise RuntimeError("Production requires HTTPS origin, a >=32 character session secret, and PostgreSQL.")
    from . import github
    from .worker import loop

    async with httpx.AsyncClient(
        timeout=25, follow_redirects=False, limits=httpx.Limits(max_connections=8, max_keepalive_connections=8)
    ) as client:
        github.transport = client
        task = asyncio.create_task(loop())
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            github.transport = None


app = FastAPI(
    title="Intervexa API",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.environment != "production" else None,
    redoc_url=None,
)
app.include_router(intelligence_router)
app.include_router(social_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.middleware("http")
async def boundary(request: Request, call_next):
    request_id = secrets.token_hex(8)
    started = time.monotonic()
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.url.path != "/api/github/webhook" and request.headers.get("origin") not in settings.origins:
            return JSONResponse({"detail": "Request origin is not allowed."}, 403)
        # Enforce limits on chunked bodies as well as Content-Length.
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 1_000_000:
                return JSONResponse({"detail": "Request exceeds the 1 MB limit."}, 413)
        request._body = bytes(body)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    # Paths are represented by route templates, never callback query strings or secrets.
    route = request.scope.get("route")
    log.info(
        json.dumps(
            {
                "request_id": request_id,
                "route": getattr(route, "path", "unknown"),
                "status": response.status_code,
                "duration_ms": round((time.monotonic() - started) * 1000),
            }
        )
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(
        {
            "detail": "Invalid request fields.",
            "fields": [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()],
        },
        422,
    )


@app.exception_handler(Exception)
async def unexpected(request, exc):
    log.error(json.dumps({"event": "unhandled_error", "type": type(exc).__name__}))
    return JSONResponse({"detail": "An internal operation failed. Retry or contact your workspace owner."}, 500)


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "Intervexa"}


@app.get("/api/ready")
def ready():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT version_num FROM alembic_version"))
            connection.execute(text("SELECT id FROM users LIMIT 1"))
    except Exception:
        raise HTTPException(503, "Database or migration unavailable.") from None
    return {"database": "ready", "queue": "database-backed", "runner_configured": bool(settings.sandbox_url)}


class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: SecretStr = Field(min_length=12, max_length=128)
    name: str = Field(default="", max_length=100)


def login_response(db, user, response):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.add(Session(id=token_hash(token), user_id=user.id, csrf=csrf, expires=time.time() + 7 * 86400))
    db.commit()
    response.set_cookie(
        "intervexa_session",
        token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=7 * 86400,
        path="/",
    )
    return {"csrf": csrf, "user": {"id": user.id, "email": user.email, "name": user.name}}


def authenticate(
    mode: Literal["register", "login"],
    body: Credentials,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
):
    limit("auth:" + (request.client.host if request.client else "unknown"), 10, 300)
    email = body.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if mode == "register":
        if user:
            raise HTTPException(409, "Account cannot be created with these details. Try signing in.")
        user = User(
            email=email,
            name=body.name.strip() or email.split("@")[0],
            password=hasher.hash(body.password.get_secret_value()),
        )
        org = Organization(name=(body.name.strip() or "My") + " workspace")
        db.add_all([user, org])
        db.flush()
        db.add(Membership(user_id=user.id, org_id=org.id, role="owner"))
        audit(db, org.id, user.email, "account.created")
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Account cannot be created with these details.") from None
    else:
        try:
            valid = hasher.verify(
                user.password if user else hasher.hash("unused dummy password"), body.password.get_secret_value()
            )
        except (VerifyMismatchError, InvalidHashError):
            valid = False
        if not user or not valid:
            raise HTTPException(401, "Email or password is incorrect.")
    return login_response(db, user, response)


@app.get("/api/me")
def me(p=Depends(principal), db: DBSession = Depends(get_db)):
    user, org, session = p
    workspace, preference = db.execute(
        select(Organization, WorkspacePreference)
        .outerjoin(WorkspacePreference, WorkspacePreference.org_id == Organization.id)
        .where(Organization.id == org)
    ).one()
    required = {
        name: getattr(settings, name.lower())
        for name in (
            "GITHUB_APP_ID",
            "GITHUB_APP_SLUG",
            "GITHUB_CLIENT_ID",
            "GITHUB_CLIENT_SECRET",
            "GITHUB_PRIVATE_KEY_PATH",
            "GITHUB_WEBHOOK_SECRET",
            "SESSION_SECRET",
        )
    }
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email},
        "organization": {"id": org, "name": workspace.name},
        "csrf": session.csrf,
        "github_configured": all(required.values()),
        "github_missing": [name for name, value in required.items() if not value],
        "runner_configured": bool(settings.sandbox_url),
        "preferences": {"theme": preference.theme if preference else "dark"},
    }


@app.post("/api/auth/register")
def register(body: Credentials, request: Request, response: Response, db: DBSession = Depends(get_db)):
    return authenticate("register", body, request, response, db)


@app.post("/api/auth/login")
def login(body: Credentials, request: Request, response: Response, db: DBSession = Depends(get_db)):
    return authenticate("login", body, request, response, db)


@app.post("/api/auth/logout")
def logout(response: Response, p=Depends(principal), db: DBSession = Depends(get_db)):
    db.delete(p[2])
    db.commit()
    response.delete_cookie("intervexa_session", path="/")
    return {"ok": True}


@app.get("/api/github/connect")
def connect(request: Request, p=Depends(principal), db: DBSession = Depends(get_db)):
    if not settings.github_client_id or not settings.github_app_slug or not settings.session_secret:
        raise HTTPException(503, "GitHub App not configured. Add the app credentials to the backend environment.")
    import jwt

    state = jwt.encode(
        {"uid": p[0].id, "nonce": secrets.token_urlsafe(24), "exp": int(time.time()) + 600},
        settings.session_secret,
        algorithm="HS256",
    )
    url = "https://github.com/login/oauth/authorize?" + urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.app_origin + "/api/github/callback",
            "state": state,
        }
    )
    response = RedirectResponse(url)
    response.set_cookie(
        "github_state",
        state,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=600,
        path="/api/github",
    )
    return response


@app.get("/api/github/callback")
async def callback(
    request: Request, code: str = "", state: str = "", p=Depends(principal), db: DBSession = Depends(get_db)
):
    import jwt

    stored = request.cookies.get("github_state", "")
    if not state or not stored or not hmac.compare_digest(state, stored):
        raise HTTPException(403, "GitHub authorization state mismatch. Start connection again.")
    try:
        payload = jwt.decode(state, settings.session_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(403, "GitHub authorization expired.") from None
    if payload["uid"] != p[0].id:
        raise HTTPException(403, "GitHub authorization belongs to another session.")
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.app_origin + "/api/github/callback",
            },
        )
    token = response.json().get("access_token")
    if not token:
        raise HTTPException(403, "GitHub authorization was not granted.")
    github = GitHub(token)
    github_user = await github.request("GET", "/user")
    # Only installations visible to the authenticated GitHub user are attachable.
    installations = await github.pages("/user/installations", "installations")
    for item in installations:
        if str(item.get("app_id")) != settings.github_app_id:
            continue
        account = item["account"]
        if account.get("type") == "Organization":
            try:
                membership = await github.request("GET", "/user/memberships/orgs/" + account["login"])
            except HTTPException:
                continue
            if membership.get("role") != "admin" or membership.get("state") != "active":
                continue
        elif account.get("id") != github_user.get("id"):
            continue
        existing = db.get(Installation, item["id"])
        if existing and existing.org_id != p[1]:
            continue
        if not existing:
            db.add(Installation(id=item["id"], org_id=p[1], account=item["account"]["login"]))
    audit(db, p[1], p[0].email, "github.authorized")
    db.commit()
    # User access token intentionally discarded, never stored.
    response = RedirectResponse(settings.app_origin + "/app/repositories")
    response.delete_cookie("github_state", path="/api/github")
    return response


@app.get("/api/github/install")
def install(p=Depends(principal)):
    if not settings.github_app_slug:
        raise HTTPException(503, "GitHub App installation is not configured.")
    return RedirectResponse("https://github.com/apps/" + settings.github_app_slug + "/installations/new")


@app.get("/api/github/available")
async def available(p=Depends(principal), db: DBSession = Depends(get_db)):
    installations = db.scalars(select(Installation).where(Installation.org_id == p[1])).all()
    repos = []
    for installation in installations:
        client = await installation_client(installation.id)
        for repo in await client.pages("/installation/repositories", "repositories"):
            repos.append(
                {
                    "installation_id": installation.id,
                    "full_name": repo["full_name"],
                    "default_branch": repo["default_branch"],
                    "private": repo["private"],
                }
            )
    return repos


class RepoInput(BaseModel):
    installation_id: int = Field(gt=0)
    full_name: str = Field(pattern=r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")


def owned(db, model, identifier, org):
    item = db.get(model, identifier)
    if not item or item.org_id != org:
        raise HTTPException(404, "Resource not found in your workspace.")
    return item


@app.post("/api/repositories")
async def add_repo(body: RepoInput, p=Depends(principal), db: DBSession = Depends(get_db)):
    installation = owned(db, Installation, body.installation_id, p[1])
    client = await installation_client(installation.id)
    accessible = await client.pages("/installation/repositories", "repositories")
    metadata = next((r for r in accessible if r["full_name"].lower() == body.full_name.lower()), None)
    if not metadata:
        raise HTTPException(403, "Repository is not accessible to this installation.")
    repo = db.scalar(select(Repository).where(Repository.org_id == p[1], Repository.full_name == metadata["full_name"]))
    if repo:
        return {"id": repo.id}
    repo = Repository(
        org_id=p[1],
        installation_id=installation.id,
        full_name=metadata["full_name"],
        default_branch=metadata["default_branch"],
    )
    db.add(repo)
    audit(db, p[1], p[0].email, "repository.connected:" + repo.full_name)
    db.commit()
    return {"id": repo.id}


@app.get("/api/repositories")
def repositories(p=Depends(principal), db: DBSession = Depends(get_db)):
    rows = db.execute(
        select(
            Repository,
            func.count(PullRequest.id),
            RepositoryIndex.sha,
            RepositoryIndex.branch,
            RepositoryIndex.created_at,
        )
        .outerjoin(PullRequest, PullRequest.repo_id == Repository.id)
        .outerjoin(RepositoryIndex, RepositoryIndex.repo_id == Repository.id)
        .where(Repository.org_id == p[1])
        .group_by(Repository.id, RepositoryIndex.sha, RepositoryIndex.branch, RepositoryIndex.created_at)
    ).all()
    return [
        {
            "id": r.id,
            "full_name": r.full_name,
            "default_branch": r.default_branch,
            "policy": r.policy,
            "pull_requests": count,
            "index": {"sha": sha, "branch": branch, "created_at": indexed_at} if sha else None,
        }
        for r, count, sha, branch, indexed_at in rows
    ]


@app.get("/api/repositories/{repo_id}")
def repository(repo_id: str, p=Depends(principal), db: DBSession = Depends(get_db)):
    r = owned(db, Repository, repo_id, p[1])
    pulls = db.scalars(select(PullRequest).where(PullRequest.repo_id == r.id)).all()
    return {
        "id": r.id,
        "full_name": r.full_name,
        "default_branch": r.default_branch,
        "policy": r.policy,
        "pulls": [
            {
                "number": pr.number,
                "title": pr.title,
                "base_sha": pr.base_sha,
                "head_sha": pr.head_sha,
                "files": pr.files,
            }
            for pr in pulls
        ],
    }


@app.post("/api/repositories/{repo_id}/sync")
async def sync(repo_id: str, p=Depends(principal), db: DBSession = Depends(get_db)):
    limit("sync:" + p[0].id, 5, 300)
    repo = owned(db, Repository, repo_id, p[1])
    client = await installation_client(repo.installation_id)
    pulls = await ingest(client, repo.full_name)
    previous = db.scalars(select(PullRequest).where(PullRequest.repo_id == repo.id)).all()
    if {(r.number, r.base_sha, r.head_sha) for r in previous} != {
        (r["number"], r["base_sha"], r["head_sha"]) for r in pulls
    }:
        for run in db.scalars(
            select(Analysis).where(Analysis.repo_id == repo.id, Analysis.state.not_in(["failed", "cancelled", "stale"]))
        ):
            run.state = "stale"
            run.updated_at = time.time()
    db.execute(delete(PullRequest).where(PullRequest.repo_id == repo.id))
    for pull in pulls:
        db.add(PullRequest(repo_id=repo.id, **pull))
    audit(db, p[1], p[0].email, "repository.synced:" + repo.full_name)
    db.commit()
    return {"count": len(pulls)}


class PolicyInput(BaseModel):
    max_pairs: int = Field(ge=1, le=20)
    retention_days: int = Field(ge=1, le=90)
    advisory: Literal[True] = True
    publish_checks: bool = False


@app.patch("/api/repositories/{repo_id}/policy")
def policy(repo_id: str, body: PolicyInput, p=Depends(principal), db: DBSession = Depends(get_db)):
    repo = owned(db, Repository, repo_id, p[1])
    repo.policy = body.model_dump()
    audit(db, p[1], p[0].email, "repository.policy_updated:" + repo.full_name)
    db.commit()
    return repo.policy


@app.delete("/api/repositories/{repo_id}")
def disconnect_repo(repo_id: str, p=Depends(principal), db: DBSession = Depends(get_db)):
    repo = owned(db, Repository, repo_id, p[1])
    audit(db, p[1], p[0].email, "repository.disconnected:" + repo.full_name)
    db.delete(repo)
    db.commit()
    return {"ok": True}


@app.delete("/api/github/connection")
def disconnect_github(p=Depends(principal), db: DBSession = Depends(get_db)):
    db.execute(delete(Installation).where(Installation.org_id == p[1]))
    audit(db, p[1], p[0].email, "github.disconnected")
    db.commit()
    return {
        "ok": True,
        "revoke_url": "https://github.com/settings/installations",
        "notice": "Local repository data removed. Revoke the GitHub installation separately on GitHub.",
    }


class AnalysisSelection(BaseModel):
    pull_numbers: list[int] | None = Field(default=None, min_length=2, max_length=10)


@app.post("/api/repositories/{repo_id}/analyses")
def create_analysis(
    repo_id: str, body: AnalysisSelection = AnalysisSelection(), p=Depends(principal), db: DBSession = Depends(get_db)
):
    limit("analysis:" + p[0].id, 5, 300)
    repo = owned(db, Repository, repo_id, p[1])
    pulls = db.scalars(select(PullRequest).where(PullRequest.repo_id == repo.id).order_by(PullRequest.number)).all()
    if body.pull_numbers is not None:
        if len(set(body.pull_numbers)) != len(body.pull_numbers):
            raise HTTPException(422, "Select distinct pull requests.")
        pulls = [r for r in pulls if r.number in body.pull_numbers]
        if len(pulls) != len(body.pull_numbers):
            raise HTTPException(422, "A selected pull request is unavailable. Sync and select again.")
    if len(pulls) < 2:
        raise HTTPException(422, "Sync at least two open pull requests before analyzing interactions.")
    snapshot = {
        "repository": repo.full_name,
        "policy": repo.policy,
        "pulls": [
            {"number": r.number, "title": r.title, "base_sha": r.base_sha, "head_sha": r.head_sha, "files": r.files}
            for r in pulls
        ],
        "merge_strategy": "ordered no-fast-forward merges",
        "environment": "isolated Python unittest runner when configured",
    }
    fingerprint = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
    for existing in db.scalars(
        select(Analysis).where(
            Analysis.repo_id == repo.id,
            Analysis.state.in_(["queued", "collecting", "analyzing", "testing", "completed", "inconclusive"]),
        )
    ):
        if existing.snapshot.get("fingerprint") == fingerprint:
            return {"id": existing.id, "deduplicated": True}
    run = Analysis(org_id=p[1], repo_id=repo.id, snapshot={**snapshot, "fingerprint": fingerprint})
    db.add(run)
    audit(db, p[1], p[0].email, "analysis.queued:" + repo.full_name)
    db.commit()
    return {"id": run.id}


@app.get("/api/analyses")
def analyses(offset: int = 0, limit_count: int = 30, p=Depends(principal), db: DBSession = Depends(get_db)):
    rows = db.execute(
        select(Analysis, func.count(Finding.id))
        .outerjoin(Finding, Finding.analysis_id == Analysis.id)
        .where(Analysis.org_id == p[1])
        .group_by(Analysis.id)
        .order_by(Analysis.created_at.desc())
        .offset(max(0, offset))
        .limit(min(max(limit_count, 1), 100))
    ).all()
    return [
        {
            "id": r.id,
            "state": r.state,
            "repository": r.snapshot.get("repository"),
            "created_at": r.created_at,
            "updated_at": r.updated_at,
            "coverage": r.coverage,
            "error": r.error,
            "findings": count,
        }
        for r, count in rows
    ]


@app.get("/api/analyses/{run_id}")
def analysis(run_id: str, p=Depends(principal), db: DBSession = Depends(get_db)):
    run = owned(db, Analysis, run_id, p[1])
    findings = db.scalars(select(Finding).where(Finding.analysis_id == run.id)).all()
    tests = db.scalars(select(TestRun).where(TestRun.analysis_id == run.id)).all()
    return {
        "id": run.id,
        "state": run.state,
        "snapshot": run.snapshot,
        "coverage": run.coverage,
        "error": run.error,
        "created_at": run.created_at,
        "findings": [{"id": f.id, "status": f.status, **f.payload} for f in findings],
        "tests": [{"id": t.id, **t.result} for t in tests],
    }


@app.post("/api/analyses/{run_id}/cancel")
def cancel(run_id: str, p=Depends(principal), db: DBSession = Depends(get_db)):
    run = owned(db, Analysis, run_id, p[1])
    if run.state not in ("queued", "collecting", "analyzing", "testing"):
        raise HTTPException(409, "Only an active analysis can be cancelled.")
    run.state = "cancelled"
    run.updated_at = time.time()
    db.commit()
    return {"state": run.state}


@app.get("/api/findings")
def findings(p=Depends(principal), db: DBSession = Depends(get_db)):
    rows = db.execute(
        select(Finding, Analysis)
        .join(Analysis, Finding.analysis_id == Analysis.id)
        .where(Analysis.org_id == p[1])
        .order_by(Analysis.created_at.desc())
        .limit(100)
    ).all()
    return [
        {
            "id": f.id,
            "analysis_id": f.analysis_id,
            "status": f.status,
            "analysis_state": a.state,
            "repository": a.snapshot["repository"],
            **f.payload,
        }
        for f, a in rows
    ]


def own_finding(db, finding_id, org):
    finding = db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(404, "Finding not found.")
    run = owned(db, Analysis, finding.analysis_id, org)
    return finding, run


@app.get("/api/findings/{finding_id}")
def finding_detail(finding_id: str, p=Depends(principal), db: DBSession = Depends(get_db)):
    f, run = own_finding(db, finding_id, p[1])
    return {
        "id": f.id,
        "analysis_id": run.id,
        "analysis_state": run.state,
        "status": f.status,
        "repository": run.snapshot["repository"],
        **f.payload,
    }


@app.post("/api/providers/test")
async def provider_test(body: ProviderInput, p=Depends(principal)):
    limit("provider:" + p[0].id, 6, 60)
    return await validate_key(body)


class PreferenceInput(BaseModel):
    provider: Literal["openai", "openrouter"]
    model: str = Field(min_length=1, max_length=100)
    max_tokens: int = Field(ge=256, le=3000)


@app.get("/api/providers/preference")
def preference_get(p=Depends(principal), db: DBSession = Depends(get_db)):
    row = db.get(ProviderPreference, p[0].id)
    return (
        {"provider": row.provider, "model": row.model, "max_tokens": row.max_tokens}
        if row and row.org_id == p[1]
        else None
    )


@app.post("/api/providers/preference")
def preference_save(body: PreferenceInput, p=Depends(principal), db: DBSession = Depends(get_db)):
    row = db.get(ProviderPreference, p[0].id)
    if not row:
        row = ProviderPreference(user_id=p[0].id, org_id=p[1], **body.model_dump())
        db.add(row)
    else:
        if row.org_id not in (None, p[1]):
            raise HTTPException(409, "Provider defaults belong to another workspace.")
        row.org_id = p[1]
        for key, value in body.model_dump().items():
            setattr(row, key, value)
    audit(db, p[1], p[0].email, "provider.preference_saved")
    db.commit()
    return {"saved": True, "key_persisted": False}


@app.delete("/api/providers/preference")
def preference_delete(p=Depends(principal), db: DBSession = Depends(get_db)):
    db.execute(
        delete(ProviderPreference).where(ProviderPreference.user_id == p[0].id, ProviderPreference.org_id == p[1])
    )
    db.commit()
    return {"ok": True}


@app.post("/api/findings/{finding_id}/generate-test")
async def generate(finding_id: str, body: GenerateInput, p=Depends(principal), db: DBSession = Depends(get_db)):
    limit("generate:" + p[0].id, 3, 300)
    f, run = own_finding(db, finding_id, p[1])
    if run.state == "stale":
        raise HTTPException(409, "This analysis is stale. Analyze the current revisions first.")
    snippets = run.coverage.get("snippets", {})
    bases = {r["base"] for r in f.payload["revisions"]}
    discoveries = [run.coverage.get("test_evidence", {}).get(base, {}) for base in bases]
    if not discoveries or any(d.get("framework") != "unittest" for d in discoveries):
        raise HTTPException(
            422,
            "Pinned repository tests do not establish supported unittest usage. Supply a reviewed test manually; automatic generation is unavailable for unknown or unsupported frameworks.",
        )
    relevant = {k: v for k, v in snippets.items() if any(k.startswith(str(n) + ":") for n in f.payload["prs"])}
    for discovery in discoveries:
        relevant.update({"existing_test:" + path: source for path, source in discovery.get("tests", {}).items()})
    result = await generate_test(
        body,
        f.payload,
        relevant,
    )
    audit(db, p[1], p[0].email, "finding.test_generated:" + f.id)
    db.commit()
    return result


class ExecuteInput(BaseModel):
    source: str = Field(min_length=1, max_length=30000)
    reviewed: Literal[True]


@app.post("/api/findings/{finding_id}/verify")
async def verify(finding_id: str, body: ExecuteInput, p=Depends(principal), db: DBSession = Depends(get_db)):
    from .runner_client import classify, execute

    limit("verify:" + p[0].id, 2, 300)
    f, run = own_finding(db, finding_id, p[1])
    if run.state in ("stale", "cancelled", "failed"):
        raise HTTPException(409, "Analysis cannot be verified in its current state.")
    prs = [r for r in run.snapshot["pulls"] if r["number"] in f.payload["prs"]]
    result = await execute(run.snapshot["repository"], prs, body.source)
    status = classify(result)
    db.refresh(run)
    if run.state in ("stale", "cancelled"):
        raise HTTPException(409, "Analysis changed during execution; results were not attached.")
    db.add(TestRun(analysis_id=run.id, result={**result, "finding_id": f.id, "status": status}))
    f.status = status
    f.payload = {
        **f.payload,
        "verification_reason": result.get(
            "reason", "Baseline, individual PRs, and repeated combined-state comparison."
        ),
        "test_source": body.source,
        "test_result": result,
        "actual": "Targeted test repeatedly failed only on the combined state."
        if status == "reproduced"
        else "The comparison did not establish a combined-only failure.",
    }
    audit(db, p[1], p[0].email, "finding.verified:" + f.id)
    db.commit()
    # Evidence remains available even when advisory Check publication is unavailable.
    try:
        repo = owned(db, Repository, run.repo_id, p[1])
        if not settings.github_publish_checks or not repo.policy.get("publish_checks", False):
            return {"status": status, "result": result}
        client = await installation_client(repo.installation_id)
        all_findings = list(db.scalars(select(Finding).where(Finding.analysis_id == run.id)))
        for pr in prs:
            await publish_check(client, repo.full_name, pr["head_sha"], run.id, all_findings)
    except HTTPException:
        run.coverage = {**run.coverage, "verification_check_update": "unavailable; evidence saved locally"}
        db.commit()
    return {"status": status, "result": result}


@app.get("/api/settings/team")
def team(p=Depends(principal), db: DBSession = Depends(get_db)):
    rows = db.execute(select(User, Membership).join(Membership).where(Membership.org_id == p[1])).all()
    return [{"name": u.name, "email": u.email, "role": m.role} for u, m in rows]


@app.get("/api/settings/audit")
def audit_list(p=Depends(principal), db: DBSession = Depends(get_db)):
    return [
        {"id": r.id, "actor": r.actor, "action": r.action, "created_at": r.created_at}
        for r in db.scalars(select(Audit).where(Audit.org_id == p[1]).order_by(Audit.created_at.desc()).limit(100))
    ]


@app.get("/api/settings/sessions")
def sessions(p=Depends(principal), db: DBSession = Depends(get_db)):
    return [
        {"current": r.id == p[2].id, "expires": r.expires}
        for r in db.scalars(select(Session).where(Session.user_id == p[0].id, Session.expires > time.time()))
    ]


@app.post("/api/settings/revoke-sessions")
def revoke_sessions(p=Depends(principal), db: DBSession = Depends(get_db)):
    db.execute(delete(Session).where(Session.user_id == p[0].id, Session.id != p[2].id))
    audit(db, p[1], p[0].email, "security.other_sessions_revoked")
    db.commit()
    return {"ok": True}


@app.post("/api/github/webhook")
async def webhook(request: Request, db: DBSession = Depends(get_db)):
    if not settings.github_webhook_secret:
        raise HTTPException(503, "Webhook secret not configured.")
    raw = await request.body()
    signature = "sha256=" + hmac.new(settings.github_webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, request.headers.get("X-Hub-Signature-256", "")):
        raise HTTPException(403, "Invalid webhook signature.")
    delivery = request.headers.get("X-GitHub-Delivery", "")
    if not re.fullmatch(r"[A-Za-z0-9-]{1,100}", delivery):
        raise HTTPException(422, "Delivery identifier required.")
    if db.get(Delivery, delivery):
        return {"duplicate": True}
    try:
        payload = json.loads(raw)
    except ValueError:
        raise HTTPException(422, "Invalid JSON payload.") from None
    if not isinstance(payload, dict):
        raise HTTPException(422, "Object payload required.")
    db.add(Delivery(id=delivery))
    installation = payload.get("installation", {}).get("id")
    event = request.headers.get("X-GitHub-Event", "")
    if event == "installation" and payload.get("action") in ("deleted", "suspend"):
        item = db.get(Installation, installation)
        if item:
            db.delete(item)
    elif event in ("pull_request", "push", "installation_repositories"):
        for repo in db.scalars(select(Repository).where(Repository.installation_id == installation)):
            if event == "installation_repositories" and any(
                r.get("full_name") == repo.full_name for r in payload.get("repositories_removed", [])
            ):
                db.delete(repo)
                continue
            if event in ("pull_request", "push") and payload.get("repository", {}).get("full_name") != repo.full_name:
                continue
            for run in db.scalars(
                select(Analysis).where(
                    Analysis.repo_id == repo.id, Analysis.state.not_in(["failed", "cancelled", "stale"])
                )
            ):
                run.state = "stale"
                run.updated_at = time.time()
            # A fresh job recollects exact current SHAs; do not reuse an old snapshot.
            pending = db.scalar(select(Analysis).where(Analysis.repo_id == repo.id, Analysis.state == "queued"))
            if not pending:
                db.add(
                    Analysis(
                        org_id=repo.org_id,
                        repo_id=repo.id,
                        snapshot={"repository": repo.full_name, "recollect": True, "policy": repo.policy},
                    )
                )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"duplicate": True}
    return {"accepted": True}
