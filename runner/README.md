# Separate isolated runner

Run only on a dedicated disposable Linux host as a non-root user with rootless Podman. Do not run this service on the frontend/API host, expose its endpoint publicly without TLS and its bearer token, or mount a host Docker socket into repository containers. API secrets, GitHub tokens, provider keys, and database credentials must never exist on this machine.

Prepare a Python image on this machine, inspect it, and set `RUNNER_IMAGE` to an immutable `name@sha256:digest` reference. The service uses `--pull=never`. Set a random >=32-character `RUNNER_TOKEN` in the service environment. Install FastAPI and uvicorn from the backend lock file. From project root run `python -m uvicorn runner.service:app --host 127.0.0.1 --port 9000`, behind a TLS reverse proxy. Set the API's `SANDBOX_URL` and `SANDBOX_TOKEN` to this separately managed service.

The runner supports public GitHub repositories, a shared base, two exact heads, regular tracked files up to 1 MB, no symlinks/submodules, and Python stdlib unittest. It performs no dependency downloads and receives no GitHub access token. Private repositories, dependencies requiring installation, and other frameworks remain unsupported. Conflicts and environment failures are inconclusive. Verify disk quotas and host-level egress restrictions before exposing this service; network is disabled in test containers, but the trusted builder fetches GitHub objects. Place the builder host on a disk quota because object fetches can be large despite command timeouts.

Each test runs with read-only mounts, no capabilities, no network, a non-root container user, 256 MB RAM, one CPU, 64 PIDs, bounded output and 30-second timeout. The container is removed after execution. Git does not invoke repository hooks or external protocols. The identical reviewed test is run on baseline, each individual merge, and the pair twice; lockfile hashes and tree identities are retained.

Containers share the host kernel. This setup is not a reviewed high-assurance sandbox for actively hostile repositories. Run only code whose provenance the owner trusts until microVM/gVisor isolation and independent security review are added. Repository code can manipulate its own test process/output; engineers must review logs and assertions. Reproduction proves reviewed test behavior, not automatic causal correctness.

This workstation has no Linux/rootless Podman runtime. The runner protocol and safety arguments can be tested with fixtures; actual isolation and execution require the separate host and must not be marked verified here.
