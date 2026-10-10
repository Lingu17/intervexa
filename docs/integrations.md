# Integration setup and verification

Code implementation and controlled tests do not establish live provider health. Keep secrets in backend environment settings or hosting secret-file interfaces. Never paste keys into chat, commit them, or put them in NEXT_PUBLIC variables.

## Exact origins and registration

The original failure was a hostname mismatch: Next binds 127.0.0.1, while APP_ORIGIN was http://localhost:3000. Development now accepts both exact loopback origins at the configured port. Different ports, schemes, lookalike hostnames and missing Origin remain rejected. Production requires exact HTTPS APP_ORIGIN and optional comma-separated ALLOWED_ORIGINS. CSRF checks remain enabled for protected writes. Restart the API after environment changes.

## Google sign-in

In Google Cloud / Google Auth Platform, configure branding, an **External** audience (personal accounts allowed), the openid/email/profile scopes and test users while the app is in testing. Create a Web application OAuth client. Add the exact authorized redirect URI:

- Local: `http://localhost:3000/api/auth/oauth/google/callback`
- Optional local alias: `http://127.0.0.1:3000/api/auth/oauth/google/callback`
- Production: `https://YOUR-FRONTEND/api/auth/oauth/google/callback`

Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the API only. Register every origin you actually use; the callback stays on the initiating trusted frontend origin. Test login/logout, state expiration, Google refusal and the existing-account linking path. The API verifies Google-signed ID tokens against Google JWKS, allowed issuer, audience, expiration, nonce and a boolean verified-email claim. It uses the stable subject identifier, not email as identity.

See Google's [OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect).

## GitHub social sign-in

Create a **separate OAuth App** in GitHub Developer settings. Homepage: frontend origin. Authorization callback: `http://localhost:3000/api/auth/oauth/github/callback` locally, or `https://YOUR-FRONTEND/api/auth/oauth/github/callback` in production. Use separate local/production OAuth Apps; GitHub OAuth Apps have a single configured callback URL. Set GITHUB_LOGIN_CLIENT_ID and GITHUB_LOGIN_CLIENT_SECRET on the API. Scopes are read:user and user:email. A verified primary email and stable GitHub user ID are required. No repository permission is requested by social login.

See [creating an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) and [authorizing OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

For either provider, an email collision requires password login followed by **Profile & data → Link provider**. An existing authenticated session is required at both initiation and callback. Matching an email cannot merge accounts. Provider access/refresh tokens are not stored. OAuth state is hashed in the database, bound to a cookie, expires in ten minutes and is consumed once.

## GitHub repository App

This is independent from social sign-in. Configure GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_PRIVATE_KEY_PATH, GITHUB_WEBHOOK_SECRET and a random >=32-character SESSION_SECRET. Missing variable names appear in the authenticated repository setup screen; values never appear.

Callback: frontend-origin/api/github/callback. Setup URL: frontend-origin/app/repositories. Webhook: API-origin/api/github/webhook, HTTPS required outside local evaluation. Subscribe to pull_request, push, installation and installation_repositories. Permissions: metadata/read, contents/read, pull requests/read; organization members/read verifies org administrator authority. checks/write is needed only for optional publication. Put the App private key in the API host's secret file, outside Git.

Install on selected repositories, authorize your GitHub account, discover granted repositories and connect one. Check branch listing, pinned indexing, PR synchronization, moving/deleted branches, revocation and webhook deliveries. The index uses exact commit/tree IDs, skips symlinks and selected credential/vendor paths, limits source to 60 files/500 KB, and has a three-minute wall timeout. A failed refresh retains the previous index. Refresh clears old embeddings so vectors never refer to a different revision.

Publishing Checks requires **both** GITHUB_PUBLISH_CHECKS=true and the repository policy checkbox. Default is disabled; outputs stay neutral/advisory. There is no PR-comment feature advertised.

## BYOK and repository retrieval

OpenAI/OpenRouter connection validation performs authenticated metadata requests without inference. Model listing is not a guarantee of generation compatibility or quota. Keys remain request-scoped and are never persisted. Questions use four lexical excerpts (at most 3,000 characters each) and require valid citations into retrieved line ranges. Citation validation does not establish the truth of every claim; interpretation remains reviewable AI output.

Optional semantic search uses OpenAI text-embedding-3-small, 256 dimensions, first 20 indexed file excerpts of 3,000 characters each. Embedding generation and query embedding are separate explicitly approved paid operations. Vectors and excerpts persist with the scoped index; source refresh invalidates them. Similarity does not verify behavior. See [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings).

## Email, contact and sandbox

Contact submissions commit to the database, with field validation, a honeypot and three submissions/hour per API-observed IP. The UI accurately reports storage, not email delivery. Contact data expires after 90 days while the worker is running. No inbox/admin review portal, email delivery, password reset or email-verification service is configured. Local development traffic shares loopback rate limits; production proxy/client-IP configuration and a distributed limiter need operator review before public launch.

Configure a separate authorized Linux rootless-Podman runner following [runner setup](../runner/README.md). A URL alone does not prove safe isolation. Until validated, keep SANDBOX_URL/TOKEN unset. The web/API never falls back to executing repository code itself.
