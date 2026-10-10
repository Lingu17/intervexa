"""Bounded deterministic analysis. Static relationships are evidence, never reproduction."""

import ast
import re
from itertools import combinations


def extract_python(source: str, path: str):
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return {"supported": False, "reason": "Python parse failed", "entities": []}
    entities = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = node.args
            signature = {
                "positional": [a.arg for a in args.posonlyargs + args.args],
                "required": len(args.posonlyargs + args.args) - len(args.defaults),
                "keyword_only": [a.arg for a in args.kwonlyargs],
                "variadic": bool(args.vararg or args.kwarg),
            }
            keys = sorted(
                {
                    key.value
                    for ret in ast.walk(node)
                    if isinstance(ret, ast.Return) and isinstance(ret.value, ast.Dict)
                    for key in ret.value.keys
                    if isinstance(key, ast.Constant) and isinstance(key.value, str)
                }
            )
            entities.append(
                {
                    "kind": "function",
                    "name": node.name,
                    "path": path,
                    "line": node.lineno,
                    "signature": signature,
                    "return_keys": keys,
                }
            )
        elif isinstance(node, ast.Call):
            name = (
                node.func.id
                if isinstance(node.func, ast.Name)
                else node.func.attr
                if isinstance(node.func, ast.Attribute)
                else None
            )
            if name:
                entities.append(
                    {
                        "kind": "call",
                        "name": name,
                        "path": path,
                        "line": node.lineno,
                        "arity": len(node.args),
                        "keywords": [k.arg for k in node.keywords],
                    }
                )
        elif (
            isinstance(node, ast.Subscript)
            and isinstance(node.slice, ast.Constant)
            and isinstance(node.slice.value, str)
        ):
            entities.append({"kind": "key_access", "name": node.slice.value, "path": path, "line": node.lineno})
    return {"supported": True, "entities": entities}


def changed_tokens(files):
    tokens = set()
    for file in files:
        for line in (file.get("patch") or "").splitlines():
            if line[:1] in ("+", "-") and not line.startswith(("+++", "---")):
                tokens.update(re.findall(r"\b[A-Za-z_][A-Za-z_0-9]{2,}\b", line[1:]))
    return tokens


def score(reasons):
    return min(95, 35 + 20 * len(set(reasons)))


def select_candidates(pulls, max_pairs=10):
    candidates = []
    for left, right in combinations(pulls, 2):
        a = {f["filename"] for f in left["files"]}
        b = {f["filename"] for f in right["files"]}
        shared = sorted(a & b)
        common = sorted(changed_tokens(left["files"]) & changed_tokens(right["files"]))
        reasons = []
        if shared:
            reasons.append("Shared changed files")
        if len(common) >= 2:
            reasons.append("Shared changed identifiers; resolution unverified")
        if not reasons:
            continue
        category = "shared-contract"
        joined = " ".join(a | b).lower()
        if re.search(r"migration|schema|models", joined):
            category = "database"
        elif re.search(r"auth|session|login", joined):
            category = "authentication"
        elif re.search(r"lock|requirements|package.json|pyproject", joined):
            category = "dependency"
        elif re.search(r"config|\.env", joined):
            category = "configuration"
        candidates.append(
            {
                "prs": [left["number"], right["number"]],
                "category": category,
                "risk": score(reasons),
                "rationale": reasons,
                "shared_files": shared,
                "identifiers": common[:20],
                "mergeable_base": left["base_sha"] == right["base_sha"],
            }
        )
    return sorted(candidates, key=lambda x: (-x["risk"], x["prs"]))[:max_pairs]


def compare_contracts(base_entities, head_entities):
    before = {e["name"]: e for e in base_entities if e["kind"] == "function"}
    changes = []
    for entity in head_entities:
        old = before.get(entity["name"])
        if entity["kind"] == "function" and old:
            if old["signature"] != entity["signature"]:
                changes.append({"type": "signature", "before": old, "after": entity})
            removed = set(old["return_keys"]) - set(entity["return_keys"])
            if removed:
                changes.append({"type": "response-keys", "removed": sorted(removed), "before": old, "after": entity})
    return changes


def finding_payload(candidate, pulls, entities, changes):
    selected = [p for p in pulls if p["number"] in candidate["prs"]]
    references = [
        dict(e, pr=number) for number, values in entities.items() if number in candidate["prs"] for e in values[:40]
    ]
    relevant_changes = [
        dict(change, pr=number) for number, values in changes.items() if number in candidate["prs"] for change in values
    ]
    return {
        **candidate,
        "title": "Potential interaction between " + " and ".join(f"PR #{n}" for n in candidate["prs"]),
        "severity": "high" if candidate["risk"] >= 75 else "medium",
        "confidence": "low" if not relevant_changes else "medium",
        "explanation": "These revisions modify overlapping files or identifiers. A shared assumption may have changed; symbol name overlap alone does not establish a resolved call relationship or defect.",
        "references": references,
        "contract_changes": relevant_changes,
        "revisions": [{"pr": p["number"], "base": p["base_sha"], "head": p["head_sha"]} for p in selected],
        "expected": "Baseline and individual changes preserve the same relevant behavior.",
        "actual": "Execution has not yet established a behavioral failure.",
        "reproduction": "Build exact candidate heads on the recorded base and run the same targeted test on baseline, each individual PR, and the combined state twice.",
        "suggested_fix": "Review the overlapping contract and its consumers. Validate any fix with the same comparison test.",
        "verification_reason": "Static evidence only; isolated execution required.",
    }
