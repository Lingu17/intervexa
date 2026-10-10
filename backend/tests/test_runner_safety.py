import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import pytest
from pydantic import ValidationError
from runner.service import Job, podman_command, validate_host


def test_sandbox_arguments_prevent_network_and_privilege():
    command = podman_command("/tmp/source", "/tmp/harness", "job")
    for value in [
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--memory=256m",
        "--user=65534:65534",
        "--pull=never",
    ]:
        assert value in command
    assert not any("docker.sock" in arg or "/var/run" in arg for arg in command)
    assert "/tmp/source:/work:ro,Z" in command


def test_malicious_repository_input_is_rejected():
    with pytest.raises(ValidationError):
        Job(
            repository="../../private",
            base_sha="a" * 40,
            pulls=[{"number": 1, "head_sha": "b" * 40}, {"number": 2, "head_sha": "c" * 40}],
            test_source="pass",
        )
    with pytest.raises(ValidationError):
        Job(repository="example/repo", base_sha="main", pulls=[], test_source="pass")


def test_this_workstation_cannot_claim_runner_ready():
    with pytest.raises(RuntimeError):
        validate_host()
