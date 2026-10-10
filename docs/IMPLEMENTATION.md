# Execution checklist

Baseline: 39 backend tests pass; frontend typecheck, lint and production build pass.

- [x] Fix exact localhost/127.0.0.1 origin mismatch; preserve CSRF.
- [x] Extend existing password sessions with Google/GitHub OAuth and explicit authenticated account linking.
- [x] Add bounded persistent contact submissions with spam/rate controls.
- [x] Add revision-pinned indexing, Python symbols/imports, file explorer, lexical/optional semantic search and source-grounded questions.
- [x] Add explicit PR selection and preserve the separate verification runner.
- [x] Redesign public site, architecture visualization and contextual workspace navigation.
- [x] Add profile/workspace updates, persisted preferences, export, account removal and setup guidance.
- [x] Verify migrations, tenant isolation, form failures, browser workflows and production build.
- [x] Record external OAuth/GitHub/runner/deployment blockers without claiming live verification.

Final local validation: 70 backend tests, six browser workflows, typecheck/lint/build, migration preservation/schema check, npm audit and pip-audit. Live external configuration and remaining production requirements are listed in [STATUS](STATUS.md).
