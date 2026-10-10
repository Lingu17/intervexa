# Application architecture

Next.js presents public information, password/social authentication and the workspace. All /api routes proxy to FastAPI. The API enforces session, workspace, exact origin and CSRF boundaries; public contact writes still require an allowed origin. PostgreSQL is required in production, SQLite is local evaluation only.

Persistent models cover users, personal workspaces, membership, hashed sessions, social identities, hashed OAuth state, GitHub installations, repositories, pinned PRs, repository indexes/vectors, queued analyses, symbols/dependencies/hypotheses, findings, test evidence, nonsecret provider preferences, workspace appearance, contact messages, audit events and webhook delivery identities. Alembic 0003 adds tables; 0004 scopes existing provider defaults and adds appearance without losing account/preferences data.

Repository intelligence indexes a bounded branch at an exact Git commit. Python AST extraction records class/function positions and imports; internal import edges match module paths within the indexed subset. Other selected text languages are searchable, not analyzed as contracts. Lexical retrieval is deterministic. Optional vectors use explicitly requested OpenAI embeddings; cosine similarity is computed over a bounded JSON vector store, avoiding a new vector service. Source refresh discards stale vectors.

Integration analysis is separate from index freshness: an analysis pins selected PR base/head revisions and policy. A persistent queue performs deterministic overlap and supported Python contract comparison. Runtime revision checks mark moved work stale. Pair evidence remains a hypothesis until a reviewed test is compared in a separate runner. Verification and AI requests never execute source on the API host.

The architecture component consumes real nodes/edges for indexed repositories. Conceptual public diagrams are visibly labeled. A lazy React Three Fiber scene uses type-specific geometry, capped modules/edges, demand-driven rendering, selection/focus and hover labels. DOM module controls and a responsive SVG provide the equivalent workflow for keyboard, reduced-motion, unavailable WebGL and rendering failure.

Personal workspaces have one owner in this release. User provider defaults are isolated to that owner's account/workspace; multi-workspace switching and invitations are not exposed. Account export covers the latest 500 retained analysis snapshots and their evidence, not a full database backup. Confirmed personal account deletion cascades local workspace data; remote provider grants/backups require operator handling.

Source retention follows repository policy (1–90 days). Contact submissions expire after 90 days; OAuth state after ten minutes; sessions after seven days. Cleanup runs in the API worker and depends on service uptime. No always-on free hosting or backup guarantee is asserted.
