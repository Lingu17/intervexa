"""Separate Linux/rootless-Podman service; NEVER deploy alongside the application API.

Public GitHub repositories and Python stdlib unittest only. No dependency installation.
"""

import ast
import asyncio
import hashlib
import hmac
import json
import os
import platform
import re
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field, model_validator

app = FastAPI(docs_url=None, redoc_url=None)
TOKEN = os.environ.get("RUNNER_TOKEN", "")
IMAGE = os.environ.get("RUNNER_IMAGE", "")  # Owner-prepared image pinned by sha256 digest.
semaphore = asyncio.Semaphore(1)


class Pull(BaseModel):
    number: int = Field(gt=0)
    head_sha: str = Field(pattern=r"^[a-f0-9]{40}$")


class Job(BaseModel):
    repository: str = Field(pattern=r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")
    base_sha: str = Field(pattern=r"^[a-f0-9]{40}$")
    pulls: list[Pull] = Field(min_length=2, max_length=2)
    test_source: str = Field(min_length=1, max_length=30000)

    @model_validator(mode="after")
    def distinct_revisions(self):
        if len({p.number for p in self.pulls}) != 2 or len({p.head_sha for p in self.pulls}) != 2:
            raise ValueError("Two distinct PRs and head revisions are required.")
        return self


def bounded(command, cwd=None, timeout=35):
    """Drain output continuously; retain at most 64 KB, without output-memory growth."""
    started = time.monotonic()
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "XDG_RUNTIME_DIR": os.environ.get("XDG_RUNTIME_DIR", ""),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_LFS_SKIP_SMUDGE": "1",
        "GIT_AUTHOR_NAME": "Intervexa",
        "GIT_AUTHOR_EMAIL": "runner@intervexa.invalid",
        "GIT_COMMITTER_NAME": "Intervexa",
        "GIT_COMMITTER_EMAIL": "runner@intervexa.invalid",
    }
    process = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
    chunks = []
    size = 0

    def drain():
        nonlocal size
        while True:
            block = process.stdout.read(4096)
            if not block:
                break
            if size < 65536:
                chunks.append(block[: 65536 - size])
                size += len(block)

    thread = threading.Thread(target=drain, daemon=True)
    thread.start()
    timed_out = False
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        process.kill()
        process.wait()
    thread.join(timeout=3)
    return {
        "exit_code": process.returncode,
        "stdout": b"".join(chunks).decode(errors="replace"),
        "timeout": timed_out,
        "duration_seconds": round(time.monotonic() - started, 3),
    }


def git(directory, *args):
    result = bounded(
        [
            "git",
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "protocol.file.allow=never",
            "-c",
            "protocol.ext.allow=never",
            "-c",
            "core.fsmonitor=false",
            *args,
        ],
        cwd=directory,
        timeout=35,
    )
    if result["exit_code"] or result["timeout"]:
        raise RuntimeError("Git candidate construction failed")
    return result["stdout"].strip()


def construct_state(repo, base_sha, included):
    git(repo, "checkout", "--force", "--detach", base_sha)
    git(repo, "clean", "-ffd")
    for pr in included:
        git(repo, "merge-base", "--is-ancestor", base_sha, pr.head_sha)
        previous = git(repo, "rev-parse", "HEAD")
        git(repo, "merge", "--no-ff", "--no-commit", pr.head_sha)
        tree = git(repo, "write-tree")
        commit = git(repo, "commit-tree", tree, "-p", previous, "-p", pr.head_sha, "-m", "Intervexa candidate")
        git(repo, "reset", "--hard", commit)
    return git(repo, "rev-parse", "HEAD"), git(repo, "rev-parse", "HEAD^{tree}")


def podman_command(source, harness, name):
    return [
        "podman",
        "run",
        "--pull=never",
        "--name",
        name,
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=64",
        "--memory=256m",
        "--cpus=1",
        "--user=65534:65534",
        "--ulimit",
        "fsize=1048576:1048576",
        "--ulimit",
        "nofile=128:128",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=16m",
        "-v",
        f"{source}:/work:ro,Z",
        "-v",
        f"{harness}:/harness:ro,Z",
        "--workdir",
        "/work",
        IMAGE,
        "python",
        "-I",
        "-B",
        "/harness/run.py",
    ]


HARNESS = """import sys, unittest, json
sys.path.insert(0, "/work")
sys.path.insert(0, "/harness")
suite = unittest.defaultTestLoader.loadTestsFromName("test_intervexa")
result = unittest.TextTestRunner(verbosity=2).run(suite)
print("INTERVEXA_RESULT=" + json.dumps({"test_count": result.testsRun, "assertion_failures": len(result.failures), "errors": len(result.errors), "failed_tests": [test.id() for test, _ in result.failures]}))
sys.exit(0 if result.wasSuccessful() else 1)
"""


def validate_host():
    if platform.system() != "Linux" or os.geteuid() == 0:
        raise RuntimeError("Runner requires a dedicated Linux host and a non-root service account.")
    if len(TOKEN) < 32 or not re.fullmatch(r".+@sha256:[a-f0-9]{64}", IMAGE):
        raise RuntimeError("Runner requires a >=32 character token and an owner-prepared digest-pinned Python image.")
    info = bounded(["podman", "info", "--format", "json"])
    if info["exit_code"] or not json.loads(info["stdout"])["host"]["security"]["rootless"]:
        raise RuntimeError("Rootless Podman is required.")


def execute(job):
    validate_host()
    ast.parse(job.test_source)
    with tempfile.TemporaryDirectory(prefix="intervexa-") as temporary:
        root = Path(temporary)
        os.chmod(root, 0o755)
        repo = root / "repo"
        repo.mkdir()
        harness = root / "harness"
        harness.mkdir()
        (harness / "run.py").write_text(HARNESS)
        (harness / "test_intervexa.py").write_text(job.test_source)
        git(repo, "init")
        git(repo, "remote", "add", "origin", "https://github.com/" + job.repository + ".git")
        # Fetch immutable objects, not moving branches; no credentials, hooks or submodules.
        for sha in [job.base_sha, *[p.head_sha for p in job.pulls]]:
            git(repo, "fetch", "--no-tags", "origin", sha)
            if git(repo, "rev-parse", sha + "^{commit}") != sha:
                raise RuntimeError("Fetched revision did not match snapshot.")
        pulls = sorted(job.pulls, key=lambda p: p.number)
        cases = []
        commits = {}
        lockfiles = {}
        sequence = [
            ("baseline", []),
            *[(f"pr-{p.number}", [p]) for p in pulls],
            ("combined-1", pulls),
            ("combined-2", pulls),
        ]
        for name, included in sequence:
            try:
                commit, tree = construct_state(repo, job.base_sha, included)
            except RuntimeError:
                return {
                    "conflict": True,
                    "reason": "Textual conflict or invalid ancestry prevents faithful candidate construction.",
                    "cases": cases,
                }
            # Archive only tracked regular files. No symlinks or submodules may enter execution.
            listing = git(repo, "ls-files", "--stage")
            if any(line.startswith(("120000", "160000")) for line in listing.splitlines()):
                return {
                    "conflict": True,
                    "reason": "Symlinks and submodules are unsupported by the isolated runner.",
                    "cases": cases,
                }
            source = root / name
            source.mkdir()
            total_bytes = 0
            file_count = 0
            for line in git(repo, "ls-files").splitlines():
                rel = Path(line)
                if rel.is_absolute() or ".." in rel.parts:
                    raise RuntimeError("Unsafe tracked path")
                content = (repo / rel).read_bytes()
                total_bytes += len(content)
                file_count += 1
                if total_bytes > 20_000_000 or file_count > 2000:
                    raise RuntimeError("Repository exceeds the 20 MB / 2,000 file execution bound")
                if len(content) > 1_000_000:
                    raise RuntimeError("Tracked file exceeds 1 MB runner bound")
                destination = source / rel
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(content)
            if name == "combined-1":
                for pattern in ("*lock*", "requirements*.txt", "pyproject.toml"):
                    for file in source.rglob(pattern):
                        if file.is_file():
                            lockfiles[str(file.relative_to(source))] = hashlib.sha256(file.read_bytes()).hexdigest()
            container = "intervexa-" + uuid.uuid4().hex
            try:
                result = bounded(podman_command(source, harness, container), timeout=30)
            finally:
                bounded(["podman", "rm", "--force", container], timeout=10)
            result.update(
                {
                    "name": name,
                    "commit": commit,
                    "tree": tree,
                    "test_count": 0,
                    "assertion_failures": 0,
                    "errors": 0,
                    "failed_tests": [],
                }
            )
            matches = re.findall(r"^INTERVEXA_RESULT=(.+)$", result["stdout"], re.MULTILINE)
            if matches:
                try:
                    metrics = json.loads(matches[-1])
                    for key in ("test_count", "assertion_failures", "errors", "failed_tests"):
                        result[key] = metrics[key]
                except (ValueError, KeyError):
                    pass
            cases.append(result)
            commits[name] = tree
        identity = hashlib.sha256(
            json.dumps(
                {
                    "repository": job.repository,
                    "base": job.base_sha,
                    "heads": [p.head_sha for p in pulls],
                    "tree": commits["combined-1"],
                    "test_sha": hashlib.sha256(job.test_source.encode()).hexdigest(),
                    "image": IMAGE,
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        return {
            "cases": cases,
            "artifact_identity": identity,
            "merge_order": [p.number for p in pulls],
            "base_sha": job.base_sha,
            "heads": [p.head_sha for p in pulls],
            "lockfiles": lockfiles,
            "image": IMAGE,
            "merge_strategy": "ordered no-fast-forward merges",
            "environment": {"network": "none", "dependencies": "stdlib only", "cpu": 1, "memory_mb": 256},
            "reason": "Reviewed test compared across exact revision states; inspect logs and assertions before accepting causal attribution.",
        }


@app.get("/health")
def health():
    try:
        validate_host()
    except Exception:
        raise HTTPException(503, "Runner configuration is not ready.") from None
    return {"status": "ready"}


@app.post("/execute")
async def run(request: Request):
    if not TOKEN or not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + TOKEN):
        raise HTTPException(401, "Runner authorization required.")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 40000:
            raise HTTPException(413, "Runner request too large.")
    try:
        job = Job.model_validate_json(raw)
        ast.parse(job.test_source)
    except (ValueError, SyntaxError):
        raise HTTPException(422, "Invalid revision snapshot or Python test.") from None
    if semaphore.locked():
        raise HTTPException(429, "Runner is busy. Retry later.")
    async with semaphore:
        try:
            return await asyncio.to_thread(execute, job)
        except Exception:
            raise HTTPException(
                422,
                "Candidate construction or isolated execution failed. Check runner configuration and supported repository limits.",
            ) from None
