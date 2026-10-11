import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
export default function Pricing() {
  return (
    <>
      <PublicNav />
      <main className="public-content pricing-page">
        <div className="eyebrow">FREE-FIRST. NO HIDDEN INFERENCE.</div>
        <h1>
          Start with evidence.
          <br />
          Bring the intelligence you need.
        </h1>
        <p className="lead">
          The application has no billing system. You control provider usage and
          infrastructure. Free service tiers are subject to their current limits
          and eligibility.
        </p>
        <div className="pricing-grid">
          <section className="price-card">
            <h3>Static analysis</h3>
            <div className="price">
              Evaluation <span>no billing integration</span>
            </div>
            <p>Run Intervexa on your own infrastructure.</p>
            <ul>
              <li>GitHub App repository ingestion</li>
              <li>Bounded Python symbol analysis</li>
              <li>Revision-pinned findings</li>
              <li>Advisory GitHub Checks</li>
            </ul>
            <Link className="button secondary" href="/register">
              Create workspace
            </Link>
          </section>
          <section className="price-card featured">
            <div className="eyebrow">OPTIONAL INTELLIGENCE</div>
            <h3 style={{ marginTop: 12 }}>Bring your own key</h3>
            <div className="price">
              Usage <span>billed by your provider</span>
            </div>
            <p>
              Choose OpenAI or OpenRouter. No shared paid key and no automatic
              switching.
            </p>
            <ul>
              <li>Ephemeral credentials</li>
              <li>Verified model metadata</li>
              <li>Explicit generation consent</li>
              <li>Bounded output token budget</li>
            </ul>
            <Link className="button" href="/app/settings/providers">
              Configure a provider
            </Link>
          </section>
          <section className="price-card">
            <h3>Isolated execution</h3>
            <div className="price">Your host</div>
            <p>
              Operate a separate Linux runner on infrastructure you already own
              or authorize.
            </p>
            <ul>
              <li>Rootless disposable containers</li>
              <li>Network-disabled test execution</li>
              <li>Baseline and PR comparison</li>
              <li>Exact merges and retained logs</li>
            </ul>
            <Link className="button secondary" href="/architecture">
              Review requirements
            </Link>
          </section>
        </div>
        <div className="notice">
          AI inference and hosted infrastructure may incur charges from third
          parties. No unlimited free inference is included. Connection tests do
          not generate content; generation requires explicit consent.
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
