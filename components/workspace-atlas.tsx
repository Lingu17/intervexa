"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  GitBranch,
  ScanLine,
  GitPullRequest,
  Search,
} from "lucide-react";
import { readApi, ApiError, type Repo } from "@/lib/api";
import {
  type ArchitectureNode,
  type ArchitectureEdge,
} from "@/lib/architecture";
import { Graph } from "./graph";
type MapData = {
  sha: string;
  graph: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
};
export function WorkspaceAtlas({ repositories }: { repositories?: Repo[] }) {
  const router = useRouter();
  const [map, setMap] = useState<MapData>();
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const repo = repositories?.find(r => r.id === selectedId) || repositories?.[0];
  useEffect(() => {
    let active = true;
    setMap(undefined);
    setError("");
    if (repo)
      void readApi<MapData>(`/repositories/${repo.id}/intelligence`)
        .then((data) => {
          if (active) setMap(data);
        })
        .catch((e) => { if (active) setError(e instanceof ApiError && e.status === 404 ? "This repository has no pinned index. Open the explorer to index a branch." : e.message || "The code map could not load."); });
    return () => {
      active = false;
    };
  }, [repo, retry]);
  const href = repo ? `/app/repositories/${repo.id}` : "/app/repositories";
  const nodes: ArchitectureNode[] =
    map?.graph.nodes ||
    (repositories || []).map((r) => ({
      id: r.id,
      label: r.full_name,
      kind: "repository",
      detail:
        "Authorized repository. Open its code map to inspect indexed modules.",
    }));
  return (
    <section className="workspace-atlas">
      <div className="atlas-visual">
        <div className="atlas-heading">
          <span>
            <ScanLine size={15} />
            CODE ATLAS
          </span>
          <span>
            {map ? `REV / ${map.sha.slice(0, 7)}` : "YOUR CONNECTED SOURCE"}
          </span>
        </div>
        {!!repositories?.length && <label className="atlas-selector">Repository to explore<select aria-label="Choose atlas repository" value={repo?.id || ""} onChange={e => setSelectedId(e.target.value)}>{repositories.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label>}
        {error && <div className="atlas-map-error" role="status">{error}<button className="text-link" onClick={() => setRetry(retry + 1)}>Retry map</button></div>}
        {nodes.length ? (
          <Graph
            nodes={nodes}
            edges={map?.graph.edges || []}
            conceptual={false}
            onOpenSource={(path) => { router.push(`${href}/explore?file=${encodeURIComponent(path)}`); }}
          />
        ) : (
          <div className="atlas-empty">
            <div className="code-cube" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>
              {repositories
                ? "Connect a repository to build your code map."
                : "Your connected source will appear here."}
            </p>
          </div>
        )}
      </div>
      <div className="atlas-actions">
        <div className="eyebrow">YOUR NEXT MOVE</div>
        <h2>
          From source
          <br />
          to understanding.
        </h2>
        <p>
          One place to read the code, explore its structure and review what
          changes together.
        </p>
        {repo && (
          <div className="atlas-repo">
            <GitBranch size={15} />
            <span>{repo.full_name}</span>
            <code>{repo.default_branch}</code>
          </div>
        )}
        <Link href={repo ? `${href}/explore` : href} className="atlas-action">
          <span>
            <ScanLine size={18} />
            <strong>
              Explore the 3D code map
              <small>Files, modules & dependencies</small>
            </strong>
          </span>
          <ArrowUpRight size={18} />
        </Link>
        <Link href={href} className="atlas-action">
          <span>
            <GitPullRequest size={18} />
            <strong>
              Review pull requests<small>Sync and compare real changes</small>
            </strong>
          </span>
          <ArrowUpRight size={18} />
        </Link>
        <Link
          href={repo ? `${href}/explore?view=search` : href}
          className="atlas-action"
        >
          <span>
            <Search size={18} />
            <strong>
              Find source evidence<small>Search files & Python symbols</small>
            </strong>
          </span>
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}
