# Deployment and free-tier assessment

Checked official documentation on 2026-10-10. No remote resources have been created and no endpoint is deployed. No GitHub/deployment/provider credentials were present in the workspace environment.

## Candidate deployment

The included `render.yaml` configures **two free web services**, not paid workers: Next.js and FastAPI. Use an existing authorized Supabase free PostgreSQL project or another owner-approved PostgreSQL host. Configure `DATABASE_URL=postgresql+psycopg://...` with `sslmode=require`. Never store credentials in Git or use SQLite on an ephemeral host. Installations need a GitHub App private key uploaded as Render secret file `github-app.pem`.

1. Push the source to an owner-controlled Git repository. Connect that repository to an existing Render account. Review the blueprint and verify both services still offer the free plan. Do not accept an upgrade or add a payment method to bypass eligibility.
2. Set the backend `APP_ORIGIN` to the exact HTTPS frontend origin, `DATABASE_URL` to PostgreSQL, and a random >=32-character `SESSION_SECRET`. Supply the GitHub App settings from README. Set the frontend `BACKEND_URL` **before building**, because Next.js rewrites capture it at build time; rebuild when the endpoint changes.
3. Upload the GitHub private key through the hosting provider's secret-file UI, not the repository. Keep OAuth callback query strings out of proxy/access logs. The startup command applies migrations before exposing the API.
4. Configure the GitHub App callback and setup URLs to the frontend HTTPS origin, and webhook URL to backend `/api/github/webhook`. Verify GitHub delivery responses and signatures with a real installation.
5. Keep the runner disabled until a separately operated trusted Linux host has passed the requirements in `runner/README.md`. No free hosted sandbox is assumed.
6. Smoke test `/api/health` and `/api/ready` directly and through the frontend proxy; create an account, sign in/out, confirm protected routes reject unauthenticated and cross-tenant access, authorize GitHub, synchronize revisions, and create an analysis. Validate the provider using an owner-supplied key; generation requires separate consent.

7. Configure social OAuth clients separately from the GitHub repository App, using [the exact callback guide](integrations.md). Verify existing-account linking and personal Gmail/Outlook signup under the deployed HTTPS origin. Contact smoke tests must confirm a database row survives a backend restart, not merely a success toast. Email recovery/delivery and operator legal/contact details must be completed before advertising a public commercial launch.

The existing password-session architecture is retained; Supabase supplies PostgreSQL rather than replacing authentication and migrating existing users. In Supabase, create an owner-authorized eligible project, securely choose its database password and copy the session-pooler/direct connection details from Connect into the API's DATABASE_URL with TLS required. Do not post the URI or password in chat. Ensure the API host can reach the selected endpoint and apply all migrations. No cloud project or GitHub remote has been provisioned from this local workspace.

## Current limits and suitability

- [Vercel Hobby](https://vercel.com/docs/plans/hobby) is limited to non-commercial personal use. It is **not the default deployment for this commercial B2B SaaS**. An eligible personal evaluation could use it, but a commercial launch needs a permitted plan or another host, without unapproved spending.
- [Render free services](https://render.com/docs/free) spin down after 15 minutes without inbound traffic. Filesystems are ephemeral; free PostgreSQL expires after 30 days. The workspace shares 750 free service hours/month. Two continuously running services exceed that budget. Cold starts and interrupted jobs are expected; the persistent queue recovers expired leases on wake. There is no guaranteed continuously running free worker. Outbound bandwidth/build overages can bill accounts with a payment method; owner must enforce spend limits and review billing before provisioning.
- [Supabase free](https://supabase.com/pricing) currently includes 500 MB database storage and two active projects; inactive projects can pause after a week. Monitor size and egress and export backups. No paid plan is automatically selected.
- Sites hosting uses Cloudflare Workers and cannot run this Python backend or the isolated Linux runner. Publishing a disconnected static subset would not constitute deployment of this application. No Sites project was provisioned.

Fallback: run on an already owned machine with PostgreSQL and a TLS reverse proxy. A local-only SQLite evaluation works without spending money. Free hosting is an evaluation option, not an uptime guarantee. The server's in-memory rate limits require one API process; distributed deployments need a shared limiter before launch.

## Externally unverified

Render blueprint provisioning and Python runtime availability, PostgreSQL live connectivity, live OAuth/installations/webhooks/Checks, live AI credential acceptance/model generation, TLS/cookie behavior under deployed origins, actual Podman isolation and candidate execution, and all post-deployment smoke tests require the owner's authorized resources. Configuration files and mocked tests do not prove those integrations.
