import Link from "next/link";
import {
  ArrowRight,
  GitPullRequest,
  Network,
  ShieldCheck,
  Search,
  Code2,
  KeyRound,
} from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Graph } from "@/components/graph";
import { ProductDemo } from "@/components/product-demo";
import { ContactForm } from "@/components/contact-form";
export default function Home() {
  return (
    <>
      <PublicNav />
      <main className="marketing new-marketing">
        <section className="architecture-hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> REPOSITORY INTELLIGENCE / EARLY
              ACCESS
            </div>
            <h1>
              Understand the code.
              <br />
              See the <span>interaction.</span>
            </h1>
            <p className="hero-description">
              Explore the dependencies behind your changes.
              <br />
              Find what passing pull requests miss together.
              <br />
              Follow the evidence all the way to verification.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/register">
                Create your workspace <ArrowRight size={16} />
              </Link>
              <a href="#demo" className="text-link">
                Explore the example ↓
              </a>
            </div>
            <p className="hero-note">
              Personal email welcome · Static analysis without an AI key
            </p>
          </div>
          <div className="hero-system">
            <div className="visual-top">
              <span>
                <Network size={14} /> LIVING CODE ARCHITECTURE
              </span>
              <span>SELECT A MODULE</span>
            </div>
            <Graph />
            <div className="semantic-legend">
              <span>Violet / changes</span>
              <span>Amber / shared risk</span>
              <span>Green / verification evidence</span>
            </div>
          </div>
        </section>
        <div className="editorial-strip">
          <strong>Every change. Every interaction. Verified.</strong>
          <span>
            Repository understanding → integration hypotheses → reproducible
            evidence
          </span>
        </div>
        <section className="product-pillars">
          <div className="section-heading">
            <div className="eyebrow">ONE REPOSITORY. THREE PERSPECTIVES.</div>
            <h2>Your code isn’t a collection of isolated changes.</h2>
            <p>
              Keep architecture, pending work and verification in the same
              conversation.
            </p>
          </div>
          <div className="pillar-list">
            {[
              {
                icon: Search,
                title: "Read the system",
                text: "Browse commit-pinned source. Find files and Python symbols. Ask a question with retrieved source evidence.",
                href: "/repository-intelligence",
              },
              {
                icon: Network,
                title: "Trace the dependency",
                text: "Inspect Python import relationships and shared contracts. Know what the graph resolves—and what it leaves out.",
                href: "/architecture",
              },
              {
                icon: GitPullRequest,
                title: "Inspect the interaction",
                text: "Select PRs, rank shared evidence and compare reviewed tests across exact Git states.",
                href: "/pr-analysis",
              },
            ].map(({ icon: Icon, title, text, href }, i) => (
              <Link className="pillar-row" href={href} key={title}>
                <span className="pillar-number">0{i + 1}</span>
                <Icon size={24} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </section>
        <section className="demo-section" id="demo">
          <div>
            <div className="eyebrow">THE BUG BETWEEN TWO GREEN CHECKS</div>
            <h2>
              Both changes make sense.
              <br />
              Together, the contract breaks.
            </h2>
            <p>
              One PR renames a return key. Another adds a caller that expects
              the old key. Separate tests can pass while the combined behavior
              fails.
            </p>
            <p>
              Intervexa surfaces the shared assumption, then distinguishes a
              hypothesis from a repeatable failure. Explore this labeled source
              example.
            </p>
            <Link className="text-link" href="/how-it-works">
              Follow the verification protocol →
            </Link>
          </div>
          <ProductDemo />
        </section>
        <section className="evidence-section">
          <div>
            <div className="eyebrow">A CLAIM NEEDS A CHAIN OF EVIDENCE</div>
            <h2>
              Pin it. Inspect it.
              <br />
              Try to disprove it.
            </h2>
            <p>
              Source paths and revisions accompany static hypotheses. A separate
              runner compares baseline, individual changes and repeated combined
              states. A missing environment is an infrastructure problem, never
              a verified bug.
            </p>
            <Link className="text-link" href="/security">
              Inspect the security boundaries →
            </Link>
          </div>
          <div className="protocol-editorial">
            {[
              "01 / Authorized GitHub installation",
              "02 / Exact branch and PR revisions",
              "03 / Python AST and bounded retrieval",
              "04 / Ranked, unverified hypotheses",
              "05 / Reviewed test · separate runner",
              "06 / Logs, artifacts and human review",
            ].map((s) => (
              <div key={s}>
                <Code2 size={15} />
                {s}
              </div>
            ))}
            <span className="helper">
              Next.js → FastAPI → database queue → GitHub → optional provider /
              isolated runner
            </span>
          </div>
        </section>
        <section className="review-comparison">
          <div className="eyebrow">ADD A SYSTEM VIEW TO HUMAN REVIEW</div>
          <h2>Keep the judgment. Extend the evidence.</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Review question</th>
                  <th>Manual PR review</th>
                  <th>With Intervexa</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "What changed?",
                    "Read an individual diff",
                    "Pinned source, symbols and PR files",
                  ],
                  [
                    "What else depends on it?",
                    "Trace assumptions across files",
                    "Bounded import map and shared contracts",
                  ],
                  [
                    "Will pending changes interact?",
                    "Compare separate PRs by hand",
                    "Rank evidence from selected PRs",
                  ],
                  [
                    "Is the failure real?",
                    "Construct and test combined states",
                    "Reviewed baseline/individual/combined comparison",
                  ],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="trust-grid">
          <article>
            <ShieldCheck />
            <h3>Your source has boundaries.</h3>
            <p>
              Workspace authorization, exact origin and CSRF checks, ephemeral
              provider keys and a separate execution host. No compliance
              certification is claimed.
            </p>
            <Link href="/security">Security details →</Link>
          </article>
          <article>
            <KeyRound />
            <h3>Bring the key. Choose the cost.</h3>
            <p>
              Static workflows run without paid inference. Optional AI and
              embeddings require your key and explicit consent. Provider and
              infrastructure costs remain separate.
            </p>
            <Link href="/pricing">Pricing & usage →</Link>
          </article>
          <article>
            <Code2 />
            <h3>Useful scope, explicit limits.</h3>
            <p>
              Python AST analysis, text retrieval, GitHub App access and
              optional Python stdlib unittest execution. Private execution and
              universal language support are unavailable.
            </p>
            <Link href="/supported">Supported scope →</Link>
          </article>
        </section>
        <section className="developer-usecases">
          <div className="eyebrow">
            BUILT AROUND DEVELOPERS, NOT COMPANY DOMAINS
          </div>
          <h2>A workspace for the way you build.</h2>
          <div>
            {[
              [
                "Solo & freelance",
                "Recover context between client projects and inspect shared assumptions before shipping.",
              ],
              [
                "Open source & students",
                "Learn unfamiliar codebases, trace module dependencies and review incoming changes.",
              ],
              [
                "Startups & engineering teams",
                "Bring pending work into one evidence workflow. Current workspaces have one owner; invitations are not implemented.",
              ],
            ].map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="home-faq">
          <h2>Before you connect.</h2>
          {[
            [
              "Do I need an AI subscription?",
              "No. Static analysis and lexical source search need no AI key. Paid provider operations are optional.",
            ],
            [
              "Does a risk score mean a confirmed bug?",
              "No. It is a transparent heuristic used to prioritize review. Experimental evidence determines reproduction.",
            ],
            [
              "What happens when execution is unavailable?",
              "You can explore code and inspect hypotheses. Verification stays unavailable until a separate supported runner is configured.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <Link href="/faq">All frequently asked questions →</Link>
        </section>
        <section className="contact-section">
          <div>
            <div className="eyebrow">BUILD WITH US</div>
            <h2>What would make your next review clearer?</h2>
            <p>
              Tell us about your workflow, share feedback, or request early
              access. Don’t include credentials or confidential source.
            </p>
          </div>
          <ContactForm />
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
