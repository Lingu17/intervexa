# Premium developer workspace â€” engineering report

October 11, 2026. Extends the existing application; no replacement mockup, dependency additions, secret changes, or database migrations.

## Audit and supported scope

| State | Capability |
| --- | --- |
| Implemented | Account/session/tenant controls; selected-repository GitHub App; pinned branch indexing/source; lexical retrieval; deterministic Python AST analysis; durable analysis queue; findings/history; settings/export; contact notification queue |
| Partial | AST module-path imports and Python contracts; optional consent-bound BYOK Q&A/embeddings; advisory PR hypotheses; bounded graph and source coverage |
| Missing or externally blocked | Fully resolved dynamic/cross-language call graph; invitations/SSO/password recovery/email verification; billing; private/dependency-installing runner; deployed isolated execution and live AI credentials |

The original UI repeated similar dark sections, offered limited graph exploration, lacked source navigation from graph entities, and assumed the first connected repository on the overview. Successful malformed API JSON could masquerade as usable data. These concrete issues are addressed below.

## Changes and files

- `app/premium.css`, `app/layout.tsx`: shared midnight/navy, violet, cyan and warm off-white tokens; stronger hierarchy, spacing, quieter workspace surfaces and responsive layouts. Existing component styles and theme preferences retained.
- `app/page.tsx`, `components/product-story.tsx`, `components/public-nav.tsx`, `app/pricing/page.tsx`: varied source-preview, workflow, architecture, trust, persona, honest access/pricing, guide/FAQ, CTA and footer compositions. Functional mobile navigation; visible sign-in. One primary 3D scene on the homepage; illustrative content explicitly labeled.
- `components/auth.tsx`: focused authentication flow instead of duplicating the large architecture scene.
- `components/graph.tsx`, `components/scene.tsx`, `lib/architecture.ts`: entity search/filter, 25-node paging, full-graph incoming/outgoing relationships, selected/related emphasis, source metadata/navigation, 2D toggle, pan, orbit, zoom, fit/reset, keyboard-equivalent selection and reduced-motion/WebGL fallback. Three.js is lazy-loaded; rendering remains demand-driven with capped pixel ratio and disposed geometry.
- `backend/app/intelligence.py`: real pinned file/import graph now includes up to 240 Python AST declarations with exact source paths/lines. File nodes remain intact when symbols are bounded. Calls remain explicitly unresolved; no invented dependency resolution.
- `backend/app/main.py`, `lib/api.ts`: repository list includes actual index SHA/branch/date; fetch deadlines match indexing/AI/verification workloads; malformed JSON and network timeouts produce honest recovery states.
- `components/workspace.tsx`, `components/repository-switcher.tsx`, `components/workspace-atlas.tsx`, `components/repository-explorer.tsx`: repository switching, explicit atlas selection, index status, recovery messaging, and direct pinned-file opening without a full-page reload.
- `components/interaction-evidence.tsx`: a distinct PR relationship diagram renders persisted revisions, shared files, identifiers and evidence links. It does not suggest that an advisory relationship is a verified defect.
- `backend/tests/test_architecture_workbench.py`, `e2e/premium.spec.ts`, `e2e/workflows.spec.ts`: declaration fidelity/bounds/index metadata; responsive layout; graph paging/filter/traversal/source; malformed API recovery; PR diagram; pan/fit controls. Existing tests retained.
- `README.md`, `docs/STATUS.md`, `docs/images`: reviewer-friendly product tour, current screenshots, reproducible commands and honest verification evidence.

## Preserved workflows

Google/GitHub OAuth and account linking, password sessions/logout, CSRF/origin and tenant checks, GitHub installation authorization/discovery, branch indexing, pinned source/search, PR synchronization/selection, static analysis, immutable findings, verification evidence/unavailable state, BYOK consent, settings/export, contact storage and durable email delivery retain their existing implementations. Repository code never executes on the API host. No access scope was expanded.

Existing saved indexes remain compatible and their stored symbol metadata supplies the new AST declaration nodes on read. Reindex only when you want a newer authorized branch revision. Large graph pages show 25 entities and at most 90 visible edges; the detail panel still traverses relationships outside that page. Index coverage remains 60 files, 50 KB per file, 500 KB source total.

## Validation

- Backend: **185 tests passed**, including the existing 100 named acceptance scenarios and three new architecture tests.
- Browser: **14 tests passed**; the amended interaction and 3D controls checks also passed in the focused workflow rerun.
- TypeScript, ESLint, Ruff and production build: passed.
- Responsive widths: **1440, 1280, 768, 390**; public navigation and repository source workbench checked for horizontal overflow.
- Browser 3D canvas visibly rendered without JavaScript console errors; 2D/reduced-motion mode tested separately.
- Two initially failing browser assertions were selector ambiguity caused by multiple valid links/Next.js route alerts; selectors were narrowed and all tests reran successfully. No failure was suppressed.

Local browser fixtures are controlled test data, not evidence of live OAuth or upstream GitHub behavior. Existing real GitHub push/pull, PR analysis and contact delivery evidence is linked from the README. Live deployment verification is recorded in the release follow-up below.

## Remaining limits

Free Render services can sleep, creating cold-start delays; UI changes cannot guarantee zero loading or uptime. Static Python relationships are advisory and bounded. No universal accuracy, security certification, or hosted isolated execution is claimed. AI needs a supplied provider key; verification needs a separate supported Linux runner. Contact notifications are implemented and previously confirmed delivered; password recovery/email verification are separate unfinished features.

## Exact local commands (PowerShell)

First-time setup from the repository root:

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
Copy-Item .env.example .env.local
Copy-Item backend\.env.example backend\.env
```

Start backend in terminal 1:

```powershell
Set-Location C:\Users\HP\Desktop\Intervexa\backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Start frontend in terminal 2:

```powershell
Set-Location C:\Users\HP\Desktop\Intervexa
npm run dev
```

Open http://127.0.0.1:3000. Local SQLite works without external credentials; real GitHub/OAuth/AI integrations require their own configured credentials. Copy example files only during initial setup; preserve existing configuration.

## Live release verification

Application commit `fab6822` deployed successfully to both Render Free services. [GitHub CI #15](https://github.com/Lingu17/intervexa/actions/runs/38133640399) passed in 2m18s.

- Direct API readiness: database ready; persistent queue available; isolated runner correctly false.
- Production provider configuration: Google and GitHub true; password recovery and email verification false. Existing owner session still accesses the same workspace. A new OAuth round trip was not repeated in this redesign iteration.
- Production contact configuration: notifications true. Delivery itself was verified in the earlier email release; no additional contact email was sent for this redesign.
- GitHub discovery returned owner-authorized repositories without expanding installation scope.
- Repository switcher opened `Lingu17/intervexa-integration-check`; saved main index SHA `4da2516aa380fd735db4d9ffec2f38f67bf86414` supplied four files and four AST declarations.
- Selected `create_session`, inspected `auth.py:1` and its incoming declaration, then opened actual pinned source. Lexical search returned real `auth.py` and `client.py` excerpts at that SHA.
- Synchronized two real PRs and started analysis `8be84ab4-75f0-42d0-9902-06f2377eefab`. Finished in 18.73 seconds with one advisory finding `cfcfd83d-ae78-4f84-b159-a31923d44b8d`; execution remained explicitly inconclusive because the runner is unconfigured.
- Actual finding source references and the new PR evidence diagram loaded; settings opened and no JavaScript console errors were captured on the tested production routes.
- New README screenshots include the redesigned homepage, actual repository declaration map, actual finding, and actual PR relationship diagram. Public conceptual/illustrative examples remain labeled.

No paid plan, new credentials, billing integration, permission expansion, or customer data deletion was performed.
