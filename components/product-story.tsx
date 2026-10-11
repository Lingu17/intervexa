import Link from "next/link";
import { ArrowRight, FileCode2, GitPullRequest, ScanLine, ShieldCheck, Terminal, Network } from "lucide-react";

export function ProductProof() {
  return <section className="product-proof" aria-labelledby="proof-title">
    <div className="proof-heading"><span className="eyebrow">A SYSTEM VIEW, FROM SOURCE TO DECISION</span><h2 id="proof-title">Less guesswork.<br/>More context.</h2><p>Keep the structure, the change and its evidence together. Every repository view starts from a pinned revision.</p><Link href="/repository-intelligence" className="text-link">Inside the product <ArrowRight size={15}/></Link></div>
    <div className="proof-console">
      <div className="proof-console-bar"><span><FileCode2 size={15}/> session-service / main</span><code>ILLUSTRATIVE PRODUCT PREVIEW</code></div>
      <div className="proof-console-body"><div className="proof-file-tree"><small>INDEXED SCOPE</small><span>▾ sessions</span><code className="chosen">api.py</code><code>store.py</code><span>▾ client</span><code>login.py</code><span>▾ tests</span><code>test_session.py</code></div><div className="proof-source"><span className="eyebrow">SOURCE / SHARED CONTRACT</span><pre><code>{'def create_session(user):\n    return {"token": issue(user)}\n\n# client/login.py\nresponse = create_session(user)\ntoken = response["token"]'}</code></pre><div className="proof-evidence"><GitPullRequest size={17}/><div><strong>One return key. Two pending changes.</strong><p>A contract candidate needs review before a test can establish a failure.</p></div><span>HYPOTHESIS</span></div></div></div>
      <div className="proof-status"><span><ScanLine size={13}/> Revision-pinned source</span><span><Network size={13}/> Python module-path matches</span><span><ShieldCheck size={13}/> Evidence before conclusions</span></div>
    </div>
  </section>;
}

export function ReviewWorkflow() {
  const steps = [
    ["01", "Understand", "Index an authorized branch. Browse files, declarations and module-path matches.", "/repository-intelligence"],
    ["02", "Discover", "Select 2–10 synchronized PRs. Look for shared files and contract changes.", "/pr-analysis"],
    ["03", "Inspect", "Read source references and exact revisions. Risk is a heuristic, not a probability.", "/product"],
    ["04", "Verify", "A separate runner compares baseline, individual and repeated combined states.", "/supported"],
    ["05", "Decide", "Review the evidence. Unavailable infrastructure never counts as a verified defect.", "/how-it-works"],
  ];
  return <section className="review-workflow"><div className="workflow-intro"><span className="eyebrow">THE REVIEW LOOP</span><h2>Five moves toward<br/>an informed merge.</h2><p>A clear path through unfamiliar code and interconnected work.</p></div><div className="workflow-timeline">{steps.map(([n, title, text, href]) => <Link key={n} href={href}><code>{n}</code><h3>{title}</h3><p>{text}</p><ArrowRight size={15}/></Link>)}</div></section>;
}

export function ArchitectureIntelligence() {
  return <section className="architecture-intelligence"><div><span className="eyebrow">THE STRUCTURE BEHIND THE SOURCE</span><h2>Follow a relationship.<br/>Open the evidence.</h2><p>Files connect to their Python declarations and matching internal imports. Select a node, inspect incoming and outgoing relationships, then open its pinned source.</p><p>Dynamic imports, aliases and calls remain unresolved. The graph shows the indexed subset and explicit bounds.</p><Link className="button secondary" href="/architecture">Explore the architecture <ArrowRight size={14}/></Link></div><div className="architecture-schematic" aria-label="Illustrative indexing relationship diagram"><span className="eyebrow">ILLUSTRATIVE / SUPPORTED RELATIONSHIPS</span><div className="schematic-node root"><GitPullRequest size={19}/><strong>Exact Git revision</strong><code>branch → commit SHA</code></div><div className="schematic-stem"/><div className="schematic-branches"><div className="schematic-node"><FileCode2 size={21}/><strong>Files</strong><small>Bounded source index</small></div><div className="schematic-node"><Network size={21}/><strong>Imports</strong><small>Python module-path matches</small></div><div className="schematic-node"><Terminal size={21}/><strong>Declarations</strong><small>AST functions & classes</small></div></div><div className="schematic-foot"><ShieldCheck size={16}/> Contracts are hypotheses. Tests establish supported behavior.</div></div></section>;
}

export function AccessPricing() {
  return <section className="access-pricing"><div><span className="eyebrow">EARLY ACCESS / NO CHECKOUT</span><h2>Start with static evidence.<br/>Add intelligence on your terms.</h2><p>There is no subscription or billing system. Optional AI is billed by your provider; execution needs a separate supported runner.</p><Link href="/pricing" className="text-link">Full usage & infrastructure details →</Link></div><div className="access-ledger"><div><strong>Repository exploration</strong><span>60 files · 500 KB source / index</span></div><div><strong>PR interaction analysis</strong><span>2–10 selected PRs · bounded pairs</span></div><div><strong>Source search & 3D architecture</strong><span>No AI key required</span></div><div><strong>AI explanation & embeddings</strong><span>Optional · your key & consent</span></div><div><strong>Verification</strong><span>Separate isolated runner required</span></div><Link href="/register" className="button">Create your workspace <ArrowRight size={15}/></Link></div></section>;
}
