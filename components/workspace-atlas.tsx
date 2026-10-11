"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  GitBranch,
  ScanLine,
  GitPullRequest,
  Search,
} from "lucide-react";
import { readApi, type Repo } from "@/lib/api";
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
  const [map, setMap] = useState<MapData>();
  const repo = repositories?.[0];
  useEffect(() => {
    let active = true;
    if (repo)
      void readApi<MapData>(`/repositories/${repo.id}/intelligence`)
        .then((data) => {
          if (active) setMap(data);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [repo]);
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
        {nodes.length ? (
          <Graph
            nodes={nodes}
            edges={map?.graph.edges || []}
            conceptual={false}
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
