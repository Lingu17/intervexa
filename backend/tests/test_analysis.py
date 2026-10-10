import asyncio

import pytest

from app.analyzer import compare_contracts, extract_python, score, select_candidates
from app.runner_client import classify


def test_python_symbols_and_response_contract():
    before = extract_python('def login(user):\n return {"token": user}\n', "auth.py")["entities"]
    after = extract_python('def login(user, scope):\n return {"session": user}\n', "auth.py")["entities"]
    changes = compare_contracts(before, after)
    assert {c["type"] for c in changes} == {"signature", "response-keys"}
    assert changes[1]["removed"] == ["token"]
    assert after[0]["signature"]["required"] == 2
    assert not extract_python("def invalid(", "bad.py")["supported"]


def test_candidate_bounding_and_risk():
    pulls = [
        {
            "number": n,
            "base_sha": "a" * 40,
            "files": [{"filename": "auth.py", "patch": "+ session.token = login(session)"}],
        }
        for n in range(8)
    ]
    candidates = select_candidates(pulls, 3)
    assert len(candidates) == 3
    assert candidates[0]["prs"] == [0, 1]
    assert candidates[0]["risk"] == 75
    assert score(["same", "same"]) == 55
    assert (
        select_candidates(
            [
                {"number": 1, "base_sha": "a", "files": [{"filename": "a.py", "patch": "+ alpha"}]},
                {"number": 2, "base_sha": "a", "files": [{"filename": "b.py", "patch": "+ beta"}]},
            ]
        )
        == []
    )


def evidence():
    return {
        "cases": [
            {
                "name": name,
                "exit_code": 0 if i < 3 else 1,
                "test_count": 1,
                "assertion_failures": 0 if i < 3 else 1,
                "errors": 0,
                "failed_tests": [] if i < 3 else ["contract.test"],
            }
            for i, name in enumerate(["baseline", "pr-1", "pr-2", "combined-1", "combined-2"])
        ]
    }


def test_verification_requires_combined_only_consistent_assertions():
    result = evidence()
    assert classify(result) == "reproduced"
    result["cases"][0]["exit_code"] = 1
    assert classify(result) == "inconclusive"
    result = evidence()
    result["cases"][3]["errors"] = 1
    assert classify(result) == "inconclusive"
    result = evidence()
    result["cases"][4]["failed_tests"] = ["different.failure"]
    assert classify(result) == "inconclusive"
    result = evidence()
    for case in result["cases"]:
        case["exit_code"] = 0
    assert classify(result) == "not-reproduced"
    result["cases"][0]["test_count"] = 0
    assert classify(result) == "inconclusive"
    assert classify({"cases": [], "conflict": True}) == "inconclusive"


def test_runner_missing_does_not_execute(monkeypatch):
    from fastapi import HTTPException

    from app.config import settings
    from app.runner_client import execute

    monkeypatch.setattr(settings, "sandbox_url", "")
    with pytest.raises(HTTPException) as error:
        asyncio.run(execute("example/repo", [], "pass"))
    assert error.value.status_code == 503
