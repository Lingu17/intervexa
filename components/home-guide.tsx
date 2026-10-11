import Link from "next/link";
import { ArrowRight, BookOpen, GitPullRequest, Network } from "lucide-react";

export function HomeGuide() {
  return (
    <section
      className="home-guide"
      id="how-to-use"
      aria-labelledby="home-guide-title"
    >
      <div className="eyebrow">
        <BookOpen size={15} /> YOUR GUIDE TO INTERVEXA
      </div>
      <h2 id="home-guide-title">
        From your first repository to a confident review.
      </h2>
      <p className="guide-intro">
        Intervexa helps you understand an unfamiliar codebase and examine how
        pending pull requests may affect each other. Explore real source in 3D,
        follow dependencies, and inspect evidence before deciding what to merge.
      </p>
      <div className="guide-actions">
        <Link className="button" href="/app">
          Open your workspace <ArrowRight size={16} />
        </Link>
        <a className="button secondary" href="#feature-guide">
          See every feature
        </a>
      </div>
      <div className="guide-steps">
        {[
          [
            "01",
            "Sign in",
            "Create a workspace with your personal email, or use Google or GitHub sign-in. Sign-in identifies you; repository access is a separate permission.",
          ],
          [
            "02",
            "Connect your GitHub repository",
            "Open Repositories → Install GitHub App. Choose your account and Only select repositories. Select the repositories you want to share, then save. Authorize GitHub account when prompted and click Discover repositories.",
          ],
          [
            "03",
            "Build your code map",
            "Open a repository → Explore codebase. Choose a branch and click Refresh pinned index. Architecture shows the indexed modules; drag to orbit, zoom, select a module, or expand to fullscreen.",
          ],
          [
            "04",
            "Find the source",
            "Use Files to read indexed code, Search to find filenames, symbols and identifiers, and Dependencies to inspect Python module-path matches. Every result points to the indexed commit.",
          ],
          [
            "05",
            "Review interacting changes",
            "Return to the repository, sync open pull requests, select 2–10 PRs and start analysis. Interaction explorer shows candidate relationships when changes overlap. Review the evidence and contract changes in Findings.",
          ],
          [
            "06",
            "Verify before you merge",
            "Static findings are hypotheses. Experimental verification requires a separately configured isolated runner and a reviewed test. Compare baseline, individual PRs and repeated combined runs; inspect Test results before making a decision.",
          ],
        ].map(([step, title, text]) => (
          <article key={step}>
            <span className="guide-step-number">{step}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="guide-features" id="feature-guide">
        <div className="eyebrow">WHAT EACH PART DOES</div>
        <h3>One workspace. A clear purpose for every screen.</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Use it for</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Overview",
                  "Your connected code atlas, recent analyses, readiness and shortcuts to the next action.",
                ],
                [
                  "Repositories",
                  "Connect selected GitHub repositories, discover access, sync PRs and choose work to analyze. To add another repository, configure the existing GitHub App installation and discover again.",
                ],
                [
                  "Files & source search",
                  "Read bounded, revision-pinned source and find filenames, Python symbols and text identifiers without an AI key.",
                ],
                [
                  "3D Architecture & Dependencies",
                  "Explore files and Python module-path import relationships. Select nodes for details. A keyboard-accessible 2D view supports reduced motion or unavailable WebGL.",
                ],
                [
                  "Coverage",
                  "See what was indexed, parsing issues and omissions. The map represents the selected scope, not every dependency in the project.",
                ],
                [
                  "Interaction explorer",
                  "Inspect shared-file and changed-identifier relationships between analyzed PRs. This is separate from the repository architecture map.",
                ],
                [
                  "Analysis history & Findings",
                  "Track queued/completed/failed analyses, open recorded revisions and inspect potential signature or response-key interactions. Risk scores prioritize review; they are not measured probabilities.",
                ],
                [
                  "Test results",
                  "Inspect actual execution evidence when an isolated runner is configured. An unconfigured runner cannot verify a defect.",
                ],
                [
                  "Repository Q&A & semantic search",
                  "Optional source-grounded questions using your supported provider key; optional OpenAI embeddings require explicit consent and may incur provider charges. Static analysis and lexical search remain available without a key.",
                ],
                [
                  "Usage & limits",
                  "Inspect processing limits and workspace usage before starting more work.",
                ],
                [
                  "Settings",
                  "Manage profile, workspace appearance, provider preferences, security/audit information, export and confirmed account deletion.",
                ],
              ].map(([feature, description]) => (
                <tr key={feature}>
                  <th scope="row">{feature}</th>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="guide-help">
        <article>
          <Network size={22} />
          <h3>Why is a screen empty?</h3>
          <p>
            A repository map needs a saved index. An interaction map needs
            analyzed overlapping PRs; zero open PRs or no candidate overlap can
            produce an empty result. Findings and test results appear only after
            the corresponding work runs.
          </p>
          <Link href="/app/repositories">Start with your repository →</Link>
        </article>
        <article>
          <GitPullRequest size={22} />
          <h3>What can it establish?</h3>
          <p>
            Current static contract analysis focuses on Python. Source indexing
            is limited to 60 files, 50 KB per file and 500 KB total. Dynamic
            calls and general cross-language dependencies are unresolved. AI
            citations are checked, but an answer still needs human review.
          </p>
          <Link href="/supported">Read the supported scope →</Link>
        </article>
        <article>
          <BookOpen size={22} />
          <h3>How do I run it?</h3>
          <p>
            Use the hosted workspace in your browser; no local installation is
            needed. Free hosting can take longer to wake after inactivity.
            Deployment operators can follow Docs for local setup and
            backend/runner configuration. Email recovery and a production
            isolated runner are currently unavailable.
          </p>
          <Link href="/docs">Setup and operation guide →</Link>
        </article>
      </div>
    </section>
  );
}
