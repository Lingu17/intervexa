"""100 named, deterministic acceptance scenarios; fixtures are not production accuracy."""

from copy import deepcopy
from types import SimpleNamespace

import pytest

from app.analyzer import compare_contracts, extract_python
from app.intelligence import parse_file, retrieve
from app.runner_client import classify

CONTRACTS = [
    ("required-positional", "def f(a): pass", "def f(a,b): pass", {"signature"}),
    ("optional-positional", "def f(a): pass", "def f(a,b=1): pass", {"signature"}),
    ("removed-argument", "def f(a,b): pass", "def f(a): pass", {"signature"}),
    ("renamed-argument", "def f(a): pass", "def f(b): pass", {"signature"}),
    ("keyword-only-added", "def f(): pass", "def f(*,a): pass", {"signature"}),
    ("keyword-default-required", "def f(*,a=1): pass", "def f(*,a): pass", {"signature"}),
    ("positional-only", "def f(a): pass", "def f(a,/): pass", {"signature"}),
    ("variadic-added", "def f(): pass", "def f(*args): pass", {"signature"}),
    ("variadic-kind", "def f(*args): pass", "def f(**kwargs): pass", {"signature"}),
    ("removed-return-key", "def f(): return {'a':1,'b':2}", "def f(): return {'a':1}", {"response-keys"}),
    ("added-return-key", "def f(): return {'a':1}", "def f(): return {'a':1,'b':2}", set()),
    ("changed-return-value", "def f(): return {'a':1}", "def f(): return {'a':2}", set()),
    ("async-signature", "async def f(a): pass", "async def f(a,b): pass", {"signature"}),
    ("format-only", "def f(a): return a", "def f(a):\n    return a\n", set()),
    ("comment-only", "def f(): pass", "# comment\ndef f(): pass", set()),
    ("different-module", "def f(a): pass", "def f(a,b): pass", set()),
    ("different-class", "class A:\n def f(self,a): pass", "class B:\n def f(self,a,b): pass", set()),
    (
        "nested-return-isolation",
        "def f():\n def inner(): return {'secret':1}\n return {'ok':1}",
        "def f(): return {'ok':1}",
        set(),
    ),
    ("same-method", "class A:\n def f(self,a): pass", "class A:\n def f(self,a,b): pass", {"signature"}),
    ("unchanged-contract", "def f(a=1): return {'ok':a}", "def f(a=1): return {'ok':a}", set()),
]


@pytest.mark.parametrize("name,before,after,expected", CONTRACTS, ids=[r[0] for r in CONTRACTS])
def test_contract_accuracy(name, before, after, expected):
    left = extract_python(before, "before.py")["entities"]
    right = extract_python(after, "other.py" if name == "different-module" else "before.py")["entities"]
    assert {r["type"] for r in compare_contracts(left, right)} == expected


def evidence():
    return {
        "cases": [
            {
                "name": name,
                "exit_code": 0 if i < 3 else 1,
                "test_count": 1,
                "assertion_failures": 0 if i < 3 else 1,
                "errors": 0,
                "failed_tests": [] if i < 3 else ["contract"],
            }
            for i, name in enumerate(["baseline", "pr-1", "pr-2", "combined-1", "combined-2"])
        ]
    }


EVIDENCE_CASES = [
    "reproduced",
    "all-pass",
    "conflict",
    "missing-baseline",
    "missing-individual",
    "missing-combined",
    "baseline-fails",
    "individual-fails",
    "timeout",
    "zero-tests",
    "combined-error",
    "different-failure",
    "no-failed-tests",
    "one-pass",
    "bad-exit",
    "duplicate-baseline",
    "duplicate-combined",
    "malformed-case",
    "null-cases",
    "null-result",
]


@pytest.mark.parametrize("name", EVIDENCE_CASES)
def test_evidence_accuracy(name):
    value = deepcopy(evidence())
    cases = value["cases"]
    expected = "inconclusive"
    if name == "reproduced":
        expected = "reproduced"
    elif name == "all-pass":
        for case in cases:
            case.update(exit_code=0, assertion_failures=0, failed_tests=[])
        expected = "not-reproduced"
    elif name == "conflict":
        value["conflict"] = True
    elif name == "missing-baseline":
        cases.pop(0)
    elif name == "missing-individual":
        cases.pop(1)
    elif name == "missing-combined":
        cases.pop()
    elif name == "baseline-fails":
        cases[0]["exit_code"] = 1
    elif name == "individual-fails":
        cases[1]["exit_code"] = 1
    elif name == "timeout":
        cases[3]["timeout"] = True
    elif name == "zero-tests":
        cases[0]["test_count"] = 0
    elif name == "combined-error":
        cases[3]["errors"] = 1
    elif name == "different-failure":
        cases[4]["failed_tests"] = ["other"]
    elif name == "no-failed-tests":
        cases[3]["failed_tests"] = cases[4]["failed_tests"] = []
    elif name == "one-pass":
        cases[4]["exit_code"] = 0
    elif name == "bad-exit":
        cases[3]["exit_code"] = "1"
    elif name == "duplicate-baseline":
        cases.append(deepcopy(cases[0]))
    elif name == "duplicate-combined":
        cases.append(deepcopy(cases[3]))
    elif name == "malformed-case":
        cases.append(None)
    elif name == "null-cases":
        value["cases"] = None
    elif name == "null-result":
        value = None
    assert classify(value) == expected


SEARCHES = [
    "create_session",
    "CREATE_SESSION",
    "auth.py",
    "token",
    "save",
    "store.py",
    "store",
    "return",
    "def",
    "session",
    "auth",
    "abc",
    "missing_identifier",
    "",
    "   ",
    "!!!",
    "unseen.py",
    "create_session token",
    "SAVE",
    "token OR unknown",
]


@pytest.mark.parametrize("query", SEARCHES, ids=[f"search-{i + 1}" for i in range(20)])
def test_search_grounding(query):
    files = [
        parse_file("auth.py", "from store import save\ndef create_session():\n    return {'token': save()}\n"),
        parse_file("store.py", "def save():\n    return 'abc'\n"),
    ]
    index = SimpleNamespace(files=files, sha="a" * 40)
    results = retrieve(index, query)
    if query in {"missing_identifier", "", "   ", "!!!", "unseen.py"}:
        assert results == []
    else:
        assert results
    for result in results:
        source = next(f["source"] for f in files if f["path"] == result["path"])
        lines = source.splitlines()
        assert result["sha"] == index.sha
        assert 1 <= result["line"] <= result["end_line"] <= len(lines)
        assert result["excerpt"] == "\n".join(lines[result["line"] - 1 : result["end_line"]])


PROTECTED = [
    "/api/me",
    "/api/repositories",
    "/api/analyses",
    "/api/findings",
    "/api/settings/audit",
    "/api/settings/usage",
    "/api/settings/export",
    "/api/providers/preference",
    "/api/github/available",
    "/api/repositories/missing",
    "/api/repositories/missing/intelligence",
    "/api/repositories/missing/file?path=x",
    "/api/repositories/missing/search?q=abc",
    "/api/repositories/missing/branches",
]
ORIGINS = [
    "https://evil.example",
    "null",
    "http://localhost:3001",
    "http://localhost:3000.evil.example",
    "https://localhost:3000",
    "http://127.0.0.2:3000",
]


@pytest.mark.parametrize("path", PROTECTED)
def test_no_anonymous_workspace_access(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("origin", ORIGINS)
def test_origin_rejection(client, origin):
    assert client.post("/api/contact", headers={"Origin": origin}, json={}).status_code == 403


SOURCES = [
    ("sync", "def sample(): pass", ["sample"], False),
    ("async", "async def sample(): pass", ["sample"], False),
    ("class", "class Sample: pass", ["Sample"], False),
    ("method", "class Sample:\n def run(self): pass", ["Sample", "run"], False),
    ("nested", "def outer():\n def inner(): pass", ["outer", "inner"], False),
    ("decorated", "@decorator\ndef run(): pass", ["run"], False),
    ("annotations", "def run(a: str) -> str: return a", ["run"], False),
    ("unicode", "def café(): pass", ["café"], False),
    ("import", "import os", [], False),
    ("relative-import", "from .store import save", [], False),
    ("empty", "", [], False),
    ("comment", "# def fake(): pass", [], False),
    ("string", "text = 'def fake(): pass'", [], False),
    ("invalid-def", "def broken(", [], True),
    ("invalid-indent", "def x():\npass", [], True),
    ("invalid-null", "\x00", [], True),
    ("lambda", "fn = lambda x: x", [], False),
    ("conditional", "if True:\n def yes(): pass", ["yes"], False),
    ("match", "match 1:\n case 1: pass", [], False),
    ("async-method", "class A:\n async def run(self): pass", ["A", "run"], False),
]


@pytest.mark.parametrize("name,source,names,invalid", SOURCES, ids=[r[0] for r in SOURCES])
def test_source_parser_accuracy(name, source, names, invalid):
    parsed = parse_file("sample.py", source)
    assert sorted(s["name"] for s in parsed["symbols"]) == sorted(names)
    assert bool(parsed["issues"]) == invalid
    assert parsed["source"] == source
    assert all(1 <= s["line"] <= s["end_line"] <= len(source.splitlines()) for s in parsed["symbols"])
