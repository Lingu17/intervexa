"""Bounded, revision-pinned framework discovery; never execute discovered code."""

import ast
import hashlib


async def discover_tests(client, repository, base_sha):
    commit = await client.request("GET", f"/repos/{repository}/git/commits/{base_sha}")
    tree = await client.request(
        "GET", f"/repos/{repository}/git/trees/{commit['tree']['sha']}", params={"recursive": "1"}
    )
    if tree.get("truncated") or len(tree.get("tree", [])) > 10000:
        return {
            "framework": "unknown",
            "reason": "Repository tree exceeds bounded discovery coverage.",
            "tests": {},
            "manifests": {},
        }
    paths = [entry["path"] for entry in tree.get("tree", []) if entry.get("type") == "blob"]
    test_paths = [
        p
        for p in paths
        if p.endswith(".py") and (p.split("/")[-1].startswith("test_") or p.split("/")[-1].endswith("_test.py"))
    ][:3]
    tests = {}
    frameworks = set()
    for path in test_paths:
        source = await client.text(repository, path, base_sha)
        if not source:
            continue
        try:
            parsed = ast.parse(source)
        except SyntaxError:
            continue
        for node in ast.walk(parsed):
            modules = (
                [alias.name for alias in node.names]
                if isinstance(node, ast.Import)
                else [node.module or ""]
                if isinstance(node, ast.ImportFrom)
                else []
            )
            for module in modules:
                if module.split(".")[0] in ("unittest", "pytest"):
                    frameworks.add(module.split(".")[0])
        tests[path] = source[:3000]
    manifests = {}
    for path in [
        p
        for p in paths
        if p.split("/")[-1]
        in ("pyproject.toml", "requirements.txt", "uv.lock", "poetry.lock", "package.json", "package-lock.json")
    ][:4]:
        source = await client.text(repository, path, base_sha)
        if source:
            manifests[path] = {"sha256": hashlib.sha256(source.encode()).hexdigest(), "revision": base_sha}
    return {
        "framework": "unittest"
        if frameworks == {"unittest"}
        else "pytest-unsupported"
        if "pytest" in frameworks
        else "unknown",
        "reason": "Framework observed from imports in up to three pinned test files; incomplete discovery is reported as unknown.",
        "tests": tests,
        "manifests": manifests,
    }
