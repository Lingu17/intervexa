import Link from "next/link";
import { GitPullRequest, FileCode2, Braces, ArrowUpRight } from "lucide-react";
import type { Finding } from "@/lib/api";

/** A distinct evidence diagram: these are persisted PR relationships, not a call graph. */
export function InteractionEvidence({ finding: f }: { finding: Finding }) {
  return <div className="interaction-evidence" aria-label={`Evidence connecting pull requests ${f.prs.join(" and ")}`}>
    <div className="interaction-prs">{f.prs.map(pr => {
      const revision = f.revisions?.find(r => r.pr === pr);
      return <a key={pr} href={`https://github.com/${f.repository}/pull/${pr}`} target="_blank" rel="noreferrer" className="interaction-pr">
        <GitPullRequest size={22} /><strong>Pull request #{pr}</strong>
        <code>{revision ? revision.head.slice(0, 7) : "Revision in analysis snapshot"}</code><ArrowUpRight size={14} />
      </a>;
    })}</div>
    <div className="interaction-connectors" aria-hidden="true"><span /><span /><span /></div>
    <div className="interaction-signals">
      <div><FileCode2 size={18}/><strong>{f.shared_files.length} shared files</strong><p>{f.shared_files.join(" · ") || "No shared file evidence"}</p></div>
      <div><Braces size={18}/><strong>{f.identifiers.length} shared changed identifiers</strong><p>{f.identifiers.join(" · ") || "No shared identifier evidence"}</p></div>
    </div>
    <Link className="interaction-conclusion" href={`/app/findings/${f.id}`}><span><small>{f.analysis_state === "stale" ? "STALE REVISIONS · REANALYZE" : "ADVISORY RELATIONSHIP"}</small><strong>{f.title}</strong></span><ArrowUpRight size={19}/></Link>
  </div>;
}
