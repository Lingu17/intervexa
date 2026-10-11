import base64
import json
import time
from contextlib import nullcontext
from pathlib import Path

import httpx
import jwt
from fastapi import HTTPException

from .config import settings

transport: httpx.AsyncClient | None = None


def app_jwt():
    if not settings.github_app_id or not settings.github_private_key_path:
        raise HTTPException(503, "GitHub App is not configured. Set app ID and private-key path on the backend.")
    try:
        return jwt.encode(
            {"iat": int(time.time()) - 60, "exp": int(time.time()) + 540, "iss": settings.github_app_id},
            Path(settings.github_private_key_path).read_text(),
            algorithm="RS256",
        )
    except (OSError, ValueError, jwt.PyJWTError):
        raise HTTPException(
            503, "GitHub App private key is unavailable or invalid. Check the backend secret-file configuration."
        ) from None


class GitHub:
    def __init__(self, token):
        self.token = token

    async def request(self, method, path, **kwargs):
        async with (
            nullcontext(transport)
            if transport is not None
            else httpx.AsyncClient(timeout=25, follow_redirects=False) as client
        ):
            try:
                response = await client.request(
                    method,
                    "https://api.github.com" + path,
                    headers={
                        "Authorization": "Bearer " + self.token,
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    **kwargs,
                )
            except httpx.HTTPError:
                raise HTTPException(502, "GitHub could not be reached. Retry later.") from None
        if response.status_code >= 400:
            code = (
                429
                if response.status_code == 429 or response.headers.get("x-ratelimit-remaining") == "0"
                else 403
                if response.status_code in (401, 403, 404)
                else 502
            )
            raise HTTPException(
                code, "GitHub request failed. Check installation permissions, repository access, and rate limits."
            )
        return response.json() if response.content else {}

    async def pages(self, path, key=None, max_pages=10):
        result = []
        for page in range(1, max_pages + 1):
            data = await self.request("GET", path, params={"per_page": 100, "page": page})
            items = data[key] if key else data
            result.extend(items)
            if len(items) < 100:
                return result
        raise HTTPException(422, "Repository exceeds the bounded ingestion limit. Reduce the selected scope.")

    async def text(self, repo, path, sha):
        from urllib.parse import quote

        data = await self.request("GET", f"/repos/{repo}/contents/{quote(path, safe='/')}", params={"ref": sha})
        if not isinstance(data, dict) or data.get("size", 0) > 150000 or data.get("encoding") != "base64":
            return None
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")


async def installation_client(installation_id):
    data = await GitHub(app_jwt()).request("POST", f"/app/installations/{installation_id}/access_tokens")
    return GitHub(data["token"])


async def ingest(client, repo):
    pulls = await client.pages(f"/repos/{repo}/pulls")
    if len(pulls) > 50:
        raise HTTPException(422, "Initial analyzer supports up to 50 open PRs per repository.")
    result = []
    for pr in pulls:
        files = await client.pages(f"/repos/{repo}/pulls/{pr['number']}/files", max_pages=3)
        if len(files) > 100 or len(json.dumps(files)) > 500000:
            raise HTTPException(422, "PR exceeds the initial analyzer limit of 100 files or 500 KB of diff metadata.")
        # Verify the PR has not moved while collecting its diff.
        current = await client.request("GET", f"/repos/{repo}/pulls/{pr['number']}")
        if current["head"]["sha"] != pr["head"]["sha"] or current["base"]["sha"] != pr["base"]["sha"]:
            raise HTTPException(409, "A pull request changed during collection. Retry to pin a consistent snapshot.")
        result.append(
            {
                "number": pr["number"],
                "title": pr["title"],
                "base_sha": pr["base"]["sha"],
                "head_sha": pr["head"]["sha"],
                "files": [
                    {"filename": f["filename"], "status": f["status"], "patch": f.get("patch"), "changes": f["changes"]}
                    for f in files
                ],
            }
        )
    return result


async def publish_check(client, repo, sha, analysis_id, findings, infrastructure_error=None):
    reproduced = sum(f.status == "reproduced" for f in findings)
    suspected = sum(f.status == "suspected" for f in findings)
    conclusion = "neutral"  # Advisory: never blocks a merge.
    summary = (
        infrastructure_error
        or f"{reproduced} reproduced findings; {suspected} unverified hypotheses. Advisory analysis, not a merge gate."
    )
    return await client.request(
        "POST",
        f"/repos/{repo}/check-runs",
        json={
            "name": "Intervexa / interactions",
            "head_sha": sha,
            "external_id": analysis_id,
            "status": "completed",
            "conclusion": conclusion,
            "details_url": f"{settings.app_origin}/app/analyses/{analysis_id}",
            "output": {"title": "Integration analysis: advisory results", "summary": summary},
        },
    )
