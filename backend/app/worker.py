import asyncio
import json
import logging
import time

from fastapi import HTTPException
from sqlalchemy import delete, select, update

from .analyzer import compare_contracts, extract_python, finding_payload, select_candidates
from .config import settings
from .db import SessionLocal
from .github import ingest, installation_client, publish_check
from .models import (
    Analysis,
    CodeEntity,
    ContactSubmission,
    Delivery,
    Dependency,
    Finding,
    Hypothesis,
    OAuthState,
    PullRequest,
    Repository,
    RepositoryIndex,
    Session,
    TestRun,
)
from .test_discovery import discover_tests

logger = logging.getLogger("intervexa.worker")


def transition(db, run, state):
    db.refresh(run)
    if run.state in ("cancelled", "stale"):
        return False
    run.state = state
    run.updated_at = time.time()
    db.commit()
    return True


async def process(run_id):
    with SessionLocal() as db:
        run = db.get(Analysis, run_id)
        repo = db.get(Repository, run.repo_id)
        client = await installation_client(repo.installation_id)
        if run.snapshot.get("recollect"):
            pulls = await ingest(client, repo.full_name)
            if not transition(db, run, "collecting"):
                return
            db.execute(delete(PullRequest).where(PullRequest.repo_id == repo.id))
            for pull in pulls:
                db.add(PullRequest(repo_id=repo.id, **pull))
            run.snapshot = {
                "repository": repo.full_name,
                "policy": repo.policy,
                "pulls": pulls,
                "merge_strategy": "ordered no-fast-forward merges",
                "environment": "isolated Python unittest runner when configured",
            }
            db.commit()
        pulls = run.snapshot.get("pulls", [])
        # Compare immutable head/base to current metadata before analysis and reporting.
        for pr in pulls:
            current = await client.request("GET", f"/repos/{repo.full_name}/pulls/{pr['number']}")
            if (
                current["head"]["sha"] != pr["head_sha"]
                or current["base"]["sha"] != pr["base_sha"]
                or current.get("state") != "open"
            ):
                run.state = "stale"
                run.error = "Pull request revision or open state changed before analysis."
                db.commit()
                return
        entities, changes, snippets = {}, {}, {}
        unsupported, omitted = [], []
        cache = {}
        test_evidence = {}
        for sha in sorted({pr["base_sha"] for pr in pulls})[:3]:
            test_evidence[sha] = await discover_tests(client, repo.full_name, sha)
        for pr in pulls:
            extracted, comparisons = [], []
            for file in pr["files"]:
                path = file["filename"]
                if not path.endswith(".py"):
                    unsupported.append(path)
                    continue
                if len(cache) >= 80:
                    omitted.append(path)
                    continue
                if file["status"] in ("removed", "renamed"):
                    omitted.append(path)
                    continue
                values = []
                for sha in (pr["base_sha"], pr["head_sha"]):
                    key = (sha, path)
                    if key not in cache:
                        try:
                            cache[key] = await client.text(repo.full_name, path, sha)
                        except HTTPException as exc:
                            if exc.status_code == 403 and file["status"] == "added" and sha == pr["base_sha"]:
                                cache[key] = ""
                            else:
                                raise
                    source = cache[key]
                    if source is None:
                        omitted.append(path)
                        values.append([])
                        continue
                    parsed = extract_python(source, path)
                    if not parsed["supported"]:
                        omitted.append(path)
                    values.append(parsed["entities"])
                    if sha == pr["head_sha"]:
                        snippets[f"{pr['number']}:{path}"] = source[:4000]
                extracted.extend(values[1])
                comparisons.extend(compare_contracts(values[0], values[1]))
            entities[pr["number"]] = extracted
            changes[pr["number"]] = comparisons
        if not transition(db, run, "analyzing"):
            return
        # Retries replace any partial deterministic results atomically.
        for model in (CodeEntity, Dependency, Hypothesis, Finding, TestRun):
            db.execute(delete(model).where(model.analysis_id == run.id))
        for number, values in entities.items():
            for value in values:
                db.add(CodeEntity(analysis_id=run.id, evidence={**value, "pr": number}))
        candidates = select_candidates(pulls, run.snapshot.get("policy", {}).get("max_pairs", 10))
        for candidate in candidates:
            db.add(Hypothesis(analysis_id=run.id, payload=candidate))
            for path in candidate["shared_files"]:
                db.add(
                    Dependency(
                        analysis_id=run.id,
                        source=f"PR#{candidate['prs'][0]}",
                        target=f"PR#{candidate['prs'][1]}:{path}",
                        kind="shared-file",
                    )
                )
            payload = finding_payload(candidate, pulls, entities, changes)
            if not candidate["mergeable_base"]:
                payload["verification_reason"] = "Different base commits; faithful pair construction is blocked."
            db.add(Finding(analysis_id=run.id, status="suspected", payload=payload))
        run.coverage = {
            "supported_languages": ["Python"],
            "unsupported_files": sorted(set(unsupported)),
            "omitted_files": sorted(set(omitted)),
            "symbols": sum(len(v) for v in entities.values()),
            "candidate_pairs": len(candidates),
            "pair_limit": run.snapshot.get("policy", {}).get("max_pairs", 10),
            "relationship_resolution": "Name overlap and shared-file heuristic; full call resolution, SQL migration semantics, TypeScript contracts and higher-order interactions are not supported.",
            "snippets": snippets,
            "test_evidence": test_evidence,
            "cache_hits": max(0, 2 * sum(len(p["files"]) for p in pulls) - len(cache)),
        }
        db.commit()
        if not transition(db, run, "testing"):
            return
        # No untrusted code is ever executed by this worker. Per-finding reviewed tests
        # use the separate runner via the explicit verification endpoint.
        db.add(
            TestRun(
                analysis_id=run.id,
                result={
                    "status": "inconclusive",
                    "reason": "Review or generate a targeted regression test, then verify it with the isolated runner."
                    if settings.sandbox_url
                    else "No isolated runner configured; execution was not attempted.",
                    "cases": [],
                },
            )
        )
        db.commit()
        for pr in pulls:
            current = await client.request("GET", f"/repos/{repo.full_name}/pulls/{pr['number']}")
            if current["head"]["sha"] != pr["head_sha"] or current["base"]["sha"] != pr["base_sha"]:
                run.state = "stale"
                db.commit()
                return
        if not transition(db, run, "inconclusive" if candidates else "completed"):
            return
        findings = list(db.scalars(select(Finding).where(Finding.analysis_id == run.id)))
        check_errors = []
        for pr in pulls if settings.github_publish_checks and repo.policy.get("publish_checks", False) else []:
            try:
                await publish_check(client, repo.full_name, pr["head_sha"], run.id, findings)
            except HTTPException:
                check_errors.append(pr["number"])
        run.coverage = {
            **run.coverage,
            "github_checks_failed_prs": check_errors,
            "duration_seconds": round(time.time() - run.created_at, 2),
        }
        db.commit()


async def tick():
    now = time.time()
    with SessionLocal() as db:
        # Recover abandoned leases after a process restart or crash. A job is bounded
        # by a 10 minute wall timeout; retries are deterministic and capped.
        db.execute(
            update(Analysis)
            .where(Analysis.state.in_(["collecting", "analyzing", "testing"]), Analysis.updated_at < now - 660)
            .values(state="queued", available_at=now, error="Worker lease expired; retry scheduled.")
        )
        db.execute(delete(Session).where(Session.expires < now))
        db.execute(delete(OAuthState).where(OAuthState.expires < now))
        db.execute(delete(ContactSubmission).where(ContactSubmission.created_at < now - 90 * 86400))
        db.execute(delete(Delivery).where(Delivery.created_at < now - 90 * 86400))
        for repo in db.scalars(select(Repository)):
            db.execute(
                delete(RepositoryIndex).where(
                    RepositoryIndex.repo_id == repo.id,
                    RepositoryIndex.created_at < now - repo.policy.get("retention_days", 30) * 86400,
                )
            )
            db.execute(
                delete(Analysis).where(
                    Analysis.repo_id == repo.id,
                    Analysis.created_at < now - repo.policy.get("retention_days", 30) * 86400,
                    Analysis.state.not_in(["queued", "collecting", "analyzing", "testing"]),
                )
            )
        db.commit()
        run = db.scalar(
            select(Analysis)
            .where(Analysis.state == "queued", Analysis.available_at <= now)
            .order_by(Analysis.created_at)
            .limit(1)
        )
        if not run:
            return
        # Atomic compare-and-set claim works with multiple API instances.
        claimed = db.execute(
            update(Analysis)
            .where(Analysis.id == run.id, Analysis.state == "queued")
            .values(state="collecting", updated_at=now, attempts=Analysis.attempts + 1)
        ).rowcount
        db.commit()
        run_id = run.id
        if not claimed:
            return
    try:
        await asyncio.wait_for(process(run_id), timeout=600)
    except Exception as exc:
        with SessionLocal() as db:
            run = db.get(Analysis, run_id)
            if run and run.state not in ("stale", "cancelled"):
                transient = (
                    isinstance(exc, (TimeoutError, httpx.HTTPError))
                    or isinstance(exc, HTTPException)
                    and exc.status_code in (429, 502, 503)
                )
                run.state = "queued" if transient and run.attempts < 3 else "failed"
                run.available_at = time.time() + min(120, 10 * 2**run.attempts)
                run.updated_at = time.time()
                run.error = (
                    "Integration unavailable or rate limited; bounded retry scheduled."
                    if run.state == "queued"
                    else "Analysis failed. Check GitHub App permissions and service configuration."
                )
                db.commit()
        logger.error(json.dumps({"analysis_id": run_id, "event": "job_failed", "error_type": type(exc).__name__}))


import httpx  # noqa: E402


async def loop():
    while True:
        try:
            await tick()
        except Exception as exc:
            logger.error(json.dumps({"event": "queue_unavailable", "error_type": type(exc).__name__}))
        await asyncio.sleep(2)
