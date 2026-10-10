import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Graph } from "@/components/graph";
export default function Architecture() {
  return (
    <>
      <PublicNav />
      <main className="public-content">
        <div className="eyebrow">ARCHITECTURE & COVERAGE</div>
        <h1>
          Small infrastructure.
          <br />
          Explicit trust boundaries.
        </h1>
        <p className="lead">
          Intervexa keeps repository execution outside the application server,
          and distinguishes deterministic analysis from provider-assisted test
          generation.
        </p>
        <Graph />
        {[
          {
            title: "01 / Application and identity",
            text: "Next.js presents the workspace. FastAPI enforces database sessions, CSRF verification, allowed origins, request limits, and organization access. PostgreSQL is the production database; SQLite supports local development.",
          },
          {
            title: "02 / GitHub and immutable snapshots",
            text: "A GitHub App user authorization confirms installation access. Short-lived installation tokens retrieve repository metadata, open PRs, and exact revision contents. Signed webhooks are deduplicated and invalidate stale analyses.",
          },
          {
            title: "03 / Bounded deterministic intelligence",
            text: "A database-backed queue retries transient failures at most three times. Python AST extraction identifies function signatures, calls and dictionary keys. File and identifier overlap rank pairs; this initial engine does not resolve a full call graph or analyze higher-order combinations, TypeScript contracts, or SQL migration behavior.",
          },
          {
            title: "04 / Your provider, your decision",
            text: "OpenAI and OpenRouter credentials are sent per request and held only in memory. Connection testing lists real provider metadata. Generation sends bounded code excerpts only after explicit consent. Syntax is checked before review; import compatibility is checked by execution.",
          },
          {
            title: "05 / Separate disposable execution",
            text: "The optional Linux runner uses rootless Podman with no network, dropped capabilities, read-only source, resource limits, and timeouts. It merges exact revisions in order, records lockfile identities, and runs the identical Python unittest in baseline, each individual PR, and repeated combined states. Private repositories and third-party dependency installation are currently unsupported by this runner.",
          },
          {
            title: "06 / Early-access limits",
            text: "Email verification, password recovery, team invitations, SSO, resolved cross-language contracts, automated root-cause attribution, and managed execution infrastructure are not implemented. Hosting and live integration validation require owner credentials. The product makes no compliance or availability guarantees.",
          },
        ].map(({ title, text }) => (
          <section className="panel" key={title}>
            <h3>{title}</h3>
            <p style={{ fontSize: 13, marginTop: 14, lineHeight: 1.9 }}>
              {text}
            </p>
          </section>
        ))}
      </main>
      <PublicFooter />
    </>
  );
}
