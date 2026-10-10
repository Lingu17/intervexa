import Link from "next/link";
import {
  GitPullRequest,
  Network,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
export default function Features() {
  return (
    <>
      <PublicNav />
      <main className="public-content">
        <div className="eyebrow">THE PRODUCT</div>
        <h1>
          Bring your changes
          <br />
          into the same conversation.
        </h1>
        <p className="lead">
          A connected workflow from GitHub revisions to transparent interaction
          hypotheses and test evidence.
        </p>
        <div className="feature-grid">
          {[
            {
              icon: GitPullRequest,
              title: "Revision-aware ingestion",
              text: "GitHub App installations control repository access. Exact base and head SHAs are recorded; changed revisions invalidate earlier analyses.",
            },
            {
              icon: Network,
              title: "Transparent interaction graph",
              text: "Python AST extraction compares function signatures and dictionary return keys. Shared changed files and identifiers select bounded, risk-ranked pairs.",
            },
            {
              icon: FlaskConical,
              title: "Deliberate verification",
              text: "Review an AI-generated or manually written unittest. A separate runner compares baseline, individual PRs, and two combined runs.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article className="feature" key={title}>
              <div className="feature-top">
                <Icon size={23} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <section className="panel">
          <h3>Know what each result means</h3>
          <ul>
            <li>
              <strong>Suspected:</strong> static evidence identifies a possible
              interaction; execution has not proved a defect.
            </li>
            <li>
              <strong>Reproduced:</strong> the reviewed targeted test passes on
              baseline and individual PR states, then repeatedly fails with
              assertions on their combination.
            </li>
            <li>
              <strong>Not reproduced:</strong> the targeted comparison passes on
              the combined state.
            </li>
            <li>
              <strong>Inconclusive:</strong> missing runner, conflicting merges,
              unsupported environment, baseline failures, or unstable results
              prevent a conclusion.
            </li>
          </ul>
          <p className="helper">
            Reproduction demonstrates the test behavior. A suggested root cause
            or fix still needs engineering review.
          </p>
        </section>
        <Link className="button" href="/register">
          Start a workspace <ArrowRight size={15} />
        </Link>
      </main>
      <PublicFooter />
    </>
  );
}
