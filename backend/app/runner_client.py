from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from .config import settings


async def execute(repository, pulls, source=None):
    if not settings.sandbox_url or not settings.sandbox_token:
        raise HTTPException(503, "Isolated runner not configured. Repository code is never executed on the API host.")
    parsed = urlparse(settings.sandbox_url)
    if parsed.scheme != "https" and settings.environment == "production":
        raise HTTPException(503, "Production runner requires HTTPS.")
    if len({p["base_sha"] for p in pulls}) != 1:
        return {
            "reason": "Selected PRs have different base commits; candidate construction blocked.",
            "cases": [],
            "conflict": True,
        }
    async with httpx.AsyncClient(timeout=240, follow_redirects=False) as client:
        try:
            response = await client.post(
                settings.sandbox_url.rstrip("/") + "/execute",
                headers={"Authorization": "Bearer " + settings.sandbox_token},
                json={
                    "repository": repository,
                    "base_sha": pulls[0]["base_sha"],
                    "pulls": [{"number": p["number"], "head_sha": p["head_sha"]} for p in pulls],
                    "test_source": source,
                },
            )
            response.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(502, "Isolated runner failed or timed out. No defect was verified.") from None
    data = response.json()
    if not isinstance(data, dict) or len(str(data)) > 300000:
        raise HTTPException(502, "Runner returned invalid or oversized evidence.")
    return data


def classify(result):
    cases = result.get("cases", [])
    by_name = {r.get("name"): r for r in cases}
    baseline = by_name.get("baseline")
    combined = [by_name.get("combined-1"), by_name.get("combined-2")]
    individuals = [r for r in cases if r.get("name", "").startswith("pr-")]
    if (
        result.get("conflict")
        or not baseline
        or len(individuals) != 2
        or any(r is None for r in combined)
        or any(r.get("timeout") or r.get("test_count", 0) < 1 or not isinstance(r.get("exit_code"), int) for r in cases)
    ):
        return "inconclusive"
    if baseline["exit_code"] != 0 or any(r["exit_code"] != 0 for r in individuals):
        return "inconclusive"
    if all(r["exit_code"] == 0 for r in combined):
        return "not-reproduced"
    if (
        all(r["exit_code"] == 1 and r.get("assertion_failures", 0) > 0 and r.get("errors", 0) == 0 for r in combined)
        and combined[0].get("failed_tests") == combined[1].get("failed_tests")
        and combined[0].get("failed_tests")
    ):
        return "reproduced"
    return "inconclusive"
