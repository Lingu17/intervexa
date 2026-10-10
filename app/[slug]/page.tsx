import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { ContactForm } from "@/components/contact-form";
import { Graph } from "@/components/graph";
const pages: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  product: {
    title: "A codebase is a system. Treat it like one.",
    intro:
      "Move from source understanding to interaction evidence in one developer workspace.",
    sections: [
      [
        "01 / Understand",
        "Connect selected GitHub repositories, pin a branch revision, browse bounded source, find Python symbols and inspect module-path import relationships. Every source result belongs to an exact commit.",
      ],
      [
        "02 / Discover",
        "Select pending pull requests and inspect overlapping files, changed identifiers and Python contracts. Transparent heuristic scores prioritize review; they do not estimate a bug probability.",
      ],
      [
        "03 / Verify",
        "Review a targeted unittest and compare baseline, individual changes and repeated combinations through a separate runner. Infrastructure problems stay inconclusive; consistent combined assertion failures can be reproduced findings.",
      ],
    ],
  },
  "repository-intelligence": {
    title: "Understand the code behind the change.",
    intro:
      "Revision-pinned file exploration, code retrieval and architecture in the same place as your pull requests.",
    sections: [
      [
        "Browse and search",
        "Index a selected branch. Search file paths, Python functions, classes and source identifiers without an AI key. Inspect line-numbered source and its commit hash. Partial coverage is visible.",
      ],
      [
        "Dependency evidence",
        "Python AST imports map to indexed module paths. Dynamic imports, aliases, external packages and runtime call graphs remain unresolved. Other selected text languages are searchable but are not parsed as contracts.",
      ],
      [
        "Semantic retrieval and Q&A",
        "An explicit paid OpenAI embedding operation indexes the first 20 file excerpts. Cosine retrieval uses 256-dimensional vectors stored with the repository index. Source-grounded questions use bounded lexical retrieval with your chosen OpenAI or OpenRouter model, and show the retrieved sources alongside the answer.",
      ],
      [
        "Know the boundary",
        "Indexing is bounded to 60 files, 50 KB per file, 500 KB of source and 10,000 tree entries. Exclusions and omissions are shown. No repository code is executed during indexing.",
      ],
    ],
  },
  "pr-analysis": {
    title: "Review the space between pull requests.",
    intro:
      "A passing change can still violate an assumption introduced by another change.",
    sections: [
      [
        "Select and pin",
        "Sync real open GitHub PRs, then select two to ten changes. Exact base/head revisions and repository policy become an immutable analysis snapshot. Moving revisions invalidate old results.",
      ],
      [
        "Rank with evidence",
        "The analyzer combines shared files and shared changed identifiers, then compares supported Python function signatures and dictionary return keys. Coverage and source references accompany each hypothesis.",
      ],
      [
        "Interpret the outcome",
        "Suspected means static evidence needs review. Reproduced requires passing baseline and individual states, then the same assertion failure twice in combination. Not reproduced means the chosen combined test passed. Missing runner, dependencies, merge conflicts or invalid tests remain inconclusive.",
      ],
    ],
  },
  "how-it-works": {
    title: "From repository to reproducible evidence.",
    intro: "Six deliberate steps, each with a visible source of truth.",
    sections: [
      [
        "1. Authorize",
        "Create a personal account. Install the configured GitHub App on selected repositories and verify installation authority.",
      ],
      [
        "2. Understand",
        "Index a branch at its exact commit. Explore source, symbols and Python import relationships.",
      ],
      [
        "3. Choose changes",
        "Synchronize open PRs. Select a supported set and capture base/head revisions.",
      ],
      [
        "4. Inspect hypotheses",
        "Review deterministic evidence, confidence limits and shared contracts. AI inference is optional and requires consent.",
      ],
      [
        "5. Verify",
        "Review a unittest. A separately hosted rootless runner constructs exact Git states and repeats combined failures.",
      ],
      [
        "6. Act",
        "Read logs and artifacts, inspect affected source, and make a human review decision. Configured GitHub Checks are advisory.",
      ],
    ],
  },
  security: {
    title: "Trust comes from explicit boundaries.",
    intro:
      "Implemented controls and current limitations, without certification claims.",
    sections: [
      [
        "Accounts and workspaces",
        "Argon2 password hashes, opaque hashed database sessions, HTTP-only cookies, exact origin checks and CSRF validation protect authenticated writes. Backend queries enforce workspace ownership. Personal email addresses are accepted.",
      ],
      [
        "OAuth and linking",
        "One-time, expiring OAuth state is bound to a browser cookie. Google ID tokens require signature, issuer, audience, expiration, nonce and verified-email checks. GitHub uses stable user IDs and verified primary email. Existing emails require authenticated linking.",
      ],
      [
        "Source and provider privacy",
        "Selected source is persisted in a bounded, tenant-scoped index until refresh, disconnect or retention cleanup. Provider keys remain in request memory. Excerpts leave the application only after explicit paid-operation consent. Provider terms govern external handling.",
      ],
      [
        "Execution boundary",
        "Untrusted source never executes in the web/API process. The optional Linux runner uses rootless Podman, no network, read-only source, dropped capabilities and resource limits. High-assurance hostile-code isolation and live infrastructure validation are not claimed.",
      ],
      [
        "Before a public launch",
        "Configure HTTPS, PostgreSQL, OAuth, GitHub App secrets and production origins. Independent security review, verified email/recovery delivery, distributed rate limiting and operational monitoring remain launch requirements.",
      ],
    ],
  },
  supported: {
    title: "A useful scope. An honest boundary.",
    intro:
      "Static workflows remain usable without paid AI or execution infrastructure.",
    sections: [
      [
        "Supported today",
        "Python AST functions/classes/imports, function signature and dictionary-return contract comparison, shared-file and changed-identifier PR heuristics. Selected TypeScript, JavaScript, SQL, Markdown and TOML files are browsable/searchable as text.",
      ],
      [
        "Verification scope",
        "Public GitHub repositories, two PRs sharing a base revision, Python stdlib unittest and a separately configured rootless Linux runner. No dependency installation, private repository execution or universal framework support.",
      ],
      [
        "Bounded ingestion",
        "Up to 50 open PRs per repository; 100 files and 500 KB diff metadata per PR. A manual analysis selects two to ten PRs; repository policy caps ranked pairs at 20.",
      ],
      [
        "Not yet supported",
        "Resolved cross-language call graphs, SQL migration semantics, higher-order combinations, automatic root-cause fixes, shared team invitations, email recovery delivery and unlimited inference.",
      ],
    ],
  },
  docs: {
    title: "Start with the source of truth.",
    intro:
      "Create a workspace, connect authorized source, then explore or analyze changes.",
    sections: [
      [
        "Getting started",
        "Run the Next frontend and FastAPI API after applying Alembic migrations. Both http://localhost:3000 and http://127.0.0.1:3000 are accepted in development at the configured port. Production accepts only explicit HTTPS origins. Create an account with any valid personal email and a 12-character or longer password.",
      ],
      [
        "GitHub App",
        "Repository access requires backend GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_PRIVATE_KEY_PATH, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_WEBHOOK_SECRET and SESSION_SECRET. Callback: frontend-origin/api/github/callback. Permissions: metadata/read, contents/read, pull requests/read, checks/write and organization members/read. No credentials means connection stays unavailable.",
      ],
      [
        "OAuth",
        "Google: create a Web application OAuth client, external consent audience and authorized callback frontend-origin/api/auth/oauth/google/callback. Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET securely on the API. GitHub: create a separate OAuth App with frontend-origin/api/auth/oauth/github/callback and GITHUB_LOGIN_CLIENT_ID/SECRET. Register exact local and production callback origins. Repository App authorization is separate from social login.",
      ],
      [
        "Repository intelligence",
        "Open a connected repository, choose Explore code, select a branch and index it. Files, search, architecture and dependencies share that pinned index. Refresh after changes. Embedding search is optional; creating vectors and embedding a query both require OpenAI credentials and paid consent.",
      ],
      [
        "BYOK",
        "Open provider settings and validate your own OpenAI or OpenRouter key. Listing models does not prove generation access. Keys disappear on refresh; nonsecret preferences can be saved. Each code-generating or answering operation requires explicit approval.",
      ],
      [
        "Troubleshooting",
        "Origin errors: match the exact scheme, host and port; use ALLOWED_ORIGINS for extra trusted origins. GitHub unavailable: configure App credentials rather than a social OAuth client. Missing source: inspect index coverage or refresh a deleted/moved branch. Runner unavailable: supported static workflows continue; do not run repository code on the API host.",
      ],
    ],
  },
  faq: {
    title: "Questions developers actually ask.",
    intro: "Scope, evidence, costs and data handling.",
    sections: [
      [
        "Can I use Gmail or Outlook?",
        "Yes. Independent developers, students, maintainers and teams use the same personal account flow. No company domain is required.",
      ],
      [
        "Is a hypothesis a verified bug?",
        "No. Static signals identify potential interactions. Reproduction requires baseline and individual states to pass, followed by the same combined assertion failure twice.",
      ],
      [
        "Do I need an AI key?",
        "No for indexing, lexical search and deterministic PR analysis. Optional embeddings, source explanations and test drafts use your provider key only after consent.",
      ],
      [
        "Is AI free?",
        "Provider usage is billed by your selected provider. Infrastructure may have separate costs. Intervexa does not include unlimited free inference or silently switch providers.",
      ],
      [
        "Can it run every repository?",
        "No. The current runner supports public repositories and Python stdlib unittest only. Private execution, dependencies and other frameworks need additional infrastructure.",
      ],
      [
        "Why can’t I connect GitHub yet?",
        "A deployment owner must configure a GitHub App. Social GitHub login alone does not grant repository access.",
      ],
      [
        "Can I delete my data?",
        "Account settings provide a bounded JSON export and confirmed account/workspace deletion for a personal workspace. Disconnecting a repository removes its local indexed and analysis data; GitHub grants must be revoked separately.",
      ],
    ],
  },
  contact: {
    title: "Tell us what you’re building.",
    intro:
      "Product questions, early-access requests and precise feedback are welcome.",
    sections: [],
  },
  privacy: {
    title: "Privacy and data handling",
    intro:
      "Early-access operational notice · Updated October 10, 2026. Deployment-specific operator identity and contact details must be supplied before public launch.",
    sections: [
      [
        "What is stored",
        "Account email/name, Argon2 password hashes, workspace memberships, hashed sessions, repository metadata, bounded selected source and embeddings, pinned analyses, evidence, nonsecret provider preferences and audit events. Contact forms store name, email, topic and message.",
      ],
      [
        "External services",
        "GitHub supplies authorized repository data. Google/GitHub verify social identity when configured. Your selected AI provider receives bounded source/question context only for approved operations. Provider API keys are not persisted.",
      ],
      [
        "Retention and removal",
        "Contact submissions expire after 90 days. Repository indexes and completed analyses expire according to repository policy, 1–90 days. OAuth state expires after 10 minutes; sessions after seven days. Cleanup requires the API worker to run. Database backups may retain deleted data under the deployment operator’s backup policy.",
      ],
      [
        "Your controls",
        "Export current account/workspace analyses in account settings and delete a personal account with confirmation. Disconnect repositories and revoke installation access at GitHub. Request help through the contact form; automated email replies are unavailable.",
      ],
      [
        "Deployment responsibilities",
        "The operator must configure lawful data handling, backup retention, privacy contact and hosting agreements for their jurisdiction. No compliance certification or absolute deletion from external providers is claimed.",
      ],
    ],
  },
  terms: {
    title: "Early-access terms",
    intro:
      "Evaluation terms. The deployment operator must supply legal identity, governing law and review these terms before a public commercial launch.",
    sections: [
      [
        "Evaluation service",
        "Intervexa provides repository exploration and integration analysis within its documented scope. Results support developer review and are not a guarantee that software is safe or bug-free.",
      ],
      [
        "Authorized access",
        "Use only repositories and accounts you are permitted to access. You are responsible for reviewed test source, provider usage, source sharing consent and applicable third-party terms.",
      ],
      [
        "Costs and availability",
        "No billing integration or commercial service-level commitment is active. Provider and infrastructure charges are separate. Early-access features, limits and availability may change.",
      ],
      [
        "Evidence and limitations",
        "AI explanations and static hypotheses may be incomplete or incorrect. Review source and execution evidence before relying on findings. The sandbox is optional and has stated language and infrastructure limitations.",
      ],
      [
        "Account data",
        "Use account export/deletion and repository disconnect controls. Privacy handling is described in the privacy notice. These evaluation terms require qualified legal review for a deployed commercial service.",
      ],
    ],
  },
  "acceptable-use": {
    title: "Acceptable use",
    intro: "Keep repository access and computation authorized.",
    sections: [
      [
        "Permission first",
        "Access and index only source you are authorized to process. Respect repository owners, licensing obligations and confidentiality requirements.",
      ],
      [
        "Protect credentials and infrastructure",
        "Do not submit credentials in source, contact forms or generated tests. Do not attempt to escape runner isolation, access another workspace, abuse APIs or bypass usage limits.",
      ],
      [
        "Review external sharing",
        "Approve provider requests only when you are authorized to send the selected excerpts. Do not use the platform to distribute malware, steal credentials or conduct unauthorized testing.",
      ],
      [
        "Report issues",
        "Use the contact form for reproducible product or security reports without including secrets. No response-time guarantee is currently configured.",
      ],
    ],
  },
  status: {
    title: "Operational status, stated precisely.",
    intro:
      "This page describes implementation scope. It is not an uptime monitor or a report of live third-party health.",
    sections: [
      [
        "Application",
        "Password accounts, database sessions, workspace authorization, persistent PR analysis queue, contact storage and bounded repository intelligence are implemented. The local evaluation database must be migrated before use.",
      ],
      [
        "Configuration-dependent",
        "Google/GitHub social sign-in, GitHub App source access, AI inference and isolated execution depend on owner credentials and infrastructure. Configuration is not proof that a service is healthy.",
      ],
      [
        "Deployment",
        "No production deployment or public URL is asserted here. Hosting access and eligible plans must be verified by the operator. Free services can sleep, pause or change quotas.",
      ],
      [
        "Support",
        "Use the database-backed contact form. Email delivery, an admin review portal and a response-time commitment are not configured.",
      ],
    ],
  },
  "forgot-password": {
    title: "Password recovery needs email delivery.",
    intro:
      "This deployment does not have a verified recovery-email service. No reset link will be sent.",
    sections: [
      [
        "Current options",
        "Use a social provider if you previously linked it to this account. Linking a new provider requires an existing authenticated session; matching an email cannot bypass this requirement.",
      ],
      [
        "Before launch",
        "A deployment owner must add and verify transactional email delivery, expiring single-use reset tokens, session revocation and abuse controls before offering password reset or email verification. Contact submissions cannot reset an account.",
      ],
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  return (
    <>
      <PublicNav />
      <main className="editorial-page">
        <div className="eyebrow">INTERVEXA / {slug.replaceAll("-", " ")}</div>
        <h1>{page.title}</h1>
        <p className="editorial-intro">{page.intro}</p>
        {slug === "product" && <Graph />}
        <div className="editorial-sections">
          {page.sections.map(([title, text]) => (
            <section id={title.toLowerCase().split(" ")[0]} key={title}>
              <h2>{title}</h2>
              <p>{text}</p>
            </section>
          ))}
        </div>
        {slug === "contact" ? (
          <ContactForm />
        ) : (
          <div className="editorial-actions">
            <Link href="/register" className="button">
              Create a personal workspace →
            </Link>
            <Link href="/contact">Contact & feedback</Link>
          </div>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
