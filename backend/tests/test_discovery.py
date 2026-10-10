import asyncio

import pytest

from app.test_discovery import discover_tests


@pytest.mark.parametrize(
    "source,expected",
    [
        ("import unittest\n", "unittest"),
        ("import pytest\n", "pytest-unsupported"),
        ("def test_example():\n pass\n", "unknown"),
    ],
)
def test_framework_is_observed_from_pinned_imports(source, expected):
    class Client:
        async def request(self, method, path, **kwargs):
            if "/git/commits/" in path:
                assert path.endswith("a" * 40)
                return {"tree": {"sha": "b" * 40}}
            assert path.endswith("b" * 40)
            return {
                "tree": [
                    {"type": "blob", "path": "tests/test_example.py"},
                    {"type": "blob", "path": "requirements.txt"},
                ]
            }

        async def text(self, repository, path, sha):
            assert sha == "a" * 40
            return source if path.endswith(".py") else "example==1.0"

    result = asyncio.run(discover_tests(Client(), "controlled/repo", "a" * 40))
    assert result["framework"] == expected
    assert result["manifests"]["requirements.txt"]["revision"] == "a" * 40
    assert len(result["manifests"]["requirements.txt"]["sha256"]) == 64
