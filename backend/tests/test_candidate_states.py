"""Actual local Git/test comparison using only self-authored controlled fixture code.

This verifies candidate logic and behavioral comparison, not Podman isolation.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from runner.service import Pull, bounded, construct_state, git

from app.runner_client import classify


def test_exact_merged_states_reproduce_combined_contract_failure(tmp_path):
    repo = tmp_path / "controlled"
    repo.mkdir()
    git(repo, "init")
    (repo / "producer.py").write_text('def response():\n    return {"token": "valid"}\n')
    (repo / "consumer.py").write_text(
        'from producer import response\ndef login():\n    result = response()\n    return result.get("token", result.get("session")) == "valid"\n'
    )
    (repo / "test_contract.py").write_text(
        'import unittest\nfrom consumer import login\nclass Contract(unittest.TestCase):\n    def test_login(self):\n        try:\n            valid = login()\n        except KeyError:\n            valid = False\n        self.assertTrue(valid, "combined changes must preserve login")\n'
    )
    git(repo, "add", ".")
    git(repo, "commit", "-m", "Controlled baseline")
    base = git(repo, "rev-parse", "HEAD")
    (repo / "producer.py").write_text('def response():\n    return {"session": "valid"}\n')
    git(repo, "add", "producer.py")
    git(repo, "commit", "-m", "PR A: response migration")
    a = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "--detach", base)
    (repo / "consumer.py").write_text(
        'from producer import response\ndef login():\n    return response()["token"] == "valid"\n'
    )
    git(repo, "add", "consumer.py")
    git(repo, "commit", "-m", "PR B: consumer simplification")
    b = git(repo, "rev-parse", "HEAD")
    pulls = [Pull(number=1, head_sha=a), Pull(number=2, head_sha=b)]
    results = []
    trees = []
    for name, included in [
        ("baseline", []),
        ("pr-1", [pulls[0]]),
        ("pr-2", [pulls[1]]),
        ("combined-1", pulls),
        ("combined-2", pulls),
    ]:
        _, tree = construct_state(repo, base, included)
        result = bounded([sys.executable, "-B", "-m", "unittest", "-v", "test_contract"], cwd=repo)
        result.update(
            {
                "name": name,
                "test_count": 1 if re.search(r"Ran 1 test", result["stdout"]) else 0,
                "assertion_failures": 1 if "FAIL: test_login" in result["stdout"] else 0,
                "errors": 1 if "ERROR:" in result["stdout"] else 0,
                "failed_tests": ["test_contract.Contract.test_login"] if result["exit_code"] else [],
            }
        )
        results.append(result)
        if name.startswith("combined"):
            trees.append(tree)
    assert [r["exit_code"] for r in results] == [0, 0, 0, 1, 1]
    assert trees[0] == trees[1]
    assert classify({"cases": results}) == "reproduced"


def test_text_conflicts_are_not_valid_candidates(tmp_path):
    import pytest

    repo = tmp_path / "conflict"
    repo.mkdir()
    git(repo, "init")
    (repo / "contract.txt").write_text("original\n")
    git(repo, "add", ".")
    git(repo, "commit", "-m", "base")
    base = git(repo, "rev-parse", "HEAD")
    heads = []
    for value in ["first", "second"]:
        git(repo, "checkout", "--detach", base)
        (repo / "contract.txt").write_text(value + "\n")
        git(repo, "add", ".")
        git(repo, "commit", "-m", value)
        heads.append(git(repo, "rev-parse", "HEAD"))
    with pytest.raises(RuntimeError):
        construct_state(repo, base, [Pull(number=1, head_sha=heads[0]), Pull(number=2, head_sha=heads[1])])
