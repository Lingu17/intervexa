# 100-scenario acceptance report

Run date: 2026-10-11. Reproducible suite: `backend/tests/test_hundred_scenarios.py`.

| Category | Scenarios | Initial pass | Final pass |
| --- | ---: | ---: | ---: |
| Python contract comparison | 20 | 14 | 20 |
| Execution evidence classification | 20 | 15 | 20 |
| Revision-pinned lexical retrieval | 20 | 20 | 20 |
| Anonymous access and origin rejection | 20 | 20 | 20 |
| Source parsing and syntax recovery | 20 | 20 | 20 |
| Total | 100 | 89 | 100 |

The 11 failures led to these code changes:

- Detect positional-only arguments, required keyword-only arguments and the distinction between `*args` and `**kwargs`.
- Match function contracts by file and qualified class/function scope. Unrelated functions with the same short name no longer produce a contract change.
- Exclude nested function/class returns from their enclosing function's response keys.
- Reject duplicate, incomplete, non-object and malformed runner evidence as inconclusive instead of crashing or accepting it as reproduced.
- Treat invalid Python input as unsupported rather than propagating parser exceptions.

Full verification: 173 backend tests and 9 browser tests passed. Frontend typecheck, ESLint and production build passed; backend Ruff passed. The backend suite includes database migration preservation, tenant isolation, OAuth validation, queue retry/recovery, secret exclusion, bounded parallel indexing, webhook signatures and provider citation rejection. Browser checks include desktop/mobile layout, all workspace sections, source exploration, interactive 3D/fallback, authentication, failures and recovery.

Run the backend checks from `backend`: `../.venv/Scripts/python.exe -m pytest -q`. Run browser checks from the repository root with the local API and frontend running: `npm run test:e2e`.

These results measure correctness on explicit deterministic examples, not general AI precision/recall or universal defect detection. There is no labeled external repository benchmark, configured production AI key or isolated production runner. Static findings remain advisory. Live execution accuracy and paid-provider answer quality cannot be claimed from mocked or local fixtures. Free hosting can sleep, so uninterrupted operation or zero cold-start delay is not guaranteed.
