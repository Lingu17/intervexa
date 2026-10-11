"use client";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Search, ArrowRight, Box, Layers } from "lucide-react";
import {
  ArchitectureNode,
  ArchitectureEdge,
  conceptualNodes,
  conceptualEdges,
  positions,
} from "@/lib/architecture";
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => (
    <div className="scene-preview" aria-label="Preparing 3D view">
      <div className="code-cube" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  ),
});
export function Fallback({
  nodes = conceptualNodes,
  edges = conceptualEdges,
  selected = 0,
  onSelect = () => {},
}: {
  nodes?: ArchitectureNode[];
  edges?: ArchitectureEdge[];
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  const points = positions(nodes).map(([x, y, z]) => [
    300 + x * 48 - y * 24,
    200 + x * 13 + y * 25 - z * 12,
  ]);
  return (
    <svg
      className="graph-fallback"
      viewBox="0 0 600 400"
      role="img"
      aria-label="Code architecture dependency map; equivalent module controls below"
    >
      <path
        d="M70 195L300 65L535 200L305 345Z"
        fill="#121c2f"
        stroke="#38435c"
        opacity=".8"
      />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i} opacity=".18" stroke="#8290ba">
          <path
            d={`M${70 + i * 33} ${195 - i * 18}L${305 + i * 33} ${345 - i * 20}`}
          />
          <path
            d={`M${70 + i * 34} ${195 + i * 21}L${300 + i * 34} ${65 + i * 19}`}
          />
        </g>
      ))}
      {edges.slice(0, 90).map((e, i) => {
        const a = nodes.findIndex((n) => n.id === e.source),
          b = nodes.findIndex((n) => n.id === e.target);
        return a < 0 || b < 0 ? null : (
          <path
            key={i}
            d={`M${points[a][0]} ${points[a][1] - 18}Q${(points[a][0] + points[b][0]) / 2} ${Math.min(points[a][1], points[b][1]) - 50} ${points[b][0]} ${points[b][1] - 18}`}
            stroke={a === selected || b === selected ? "#be9ff4" : "#67778e"}
            strokeWidth="1.2"
            fill="none"
          />
        );
      })}
      {nodes.map((n, i) => (
        <g key={n.id} onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
          <title>{`${n.kind} / ${n.label}`}</title>
          <ellipse
            cx={points[i][0]}
            cy={points[i][1] + 8}
            rx="28"
            ry="13"
            fill="#080c17"
            opacity=".6"
          />
          <path
            d={`M${points[i][0] - 22} ${points[i][1] - 24}L${points[i][0]} ${points[i][1] - 36}L${points[i][0] + 22} ${points[i][1] - 24}L${points[i][0]} ${points[i][1] - 12}Z`}
            fill={i === selected ? "#bda8ed" : "#7486ab"}
            stroke="#bca9ed"
            strokeWidth=".6"
          />
          <path
            d={`M${points[i][0] - 22} ${points[i][1] - 24}L${points[i][0]} ${points[i][1] - 12}L${points[i][0]} ${points[i][1] + 12}L${points[i][0] - 22} ${points[i][1]}Z`}
            fill={i === selected ? "#786498" : "#34425e"}
          />
          <path
            d={`M${points[i][0]} ${points[i][1] - 12}L${points[i][0] + 22} ${points[i][1] - 24}L${points[i][0] + 22} ${points[i][1]}L${points[i][0]} ${points[i][1] + 12}Z`}
            fill={i === selected ? "#594571" : "#263650"}
          />
          {[0, 1].map((line) => (
            <path
              key={line}
              d={`M${points[i][0] - 16} ${points[i][1] - 16 + line * 8}l11 6`}
              stroke="#bdc7e3"
              strokeWidth="1.5"
              opacity=".55"
            />
          ))}
          <text
            x={points[i][0]}
            y={points[i][1] + 27}
            textAnchor="middle"
            fill="#c7c5d6"
            fontSize="9"
          >
            {n.label.slice(0, 25)}
          </text>
        </g>
      ))}
    </svg>
  );
}
class Boundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function Graph({ nodes = conceptualNodes, edges = conceptualEdges, conceptual = true, onOpenSource }: {
  nodes?: ArchitectureNode[];
  edges?: ArchitectureEdge[];
  conceptual?: boolean;
  onOpenSource?: (path: string, line?: number) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [flat, setFlat] = useState(false);
  const [selectedId, setSelectedId] = useState(nodes[0]?.id || "");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(0);
  const [viewError, setViewError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => nodes.filter(n =>
    (kind === "all" || n.kind === kind) && `${n.label} ${n.path || ""}`.toLowerCase().includes(query.toLowerCase())), [nodes, kind, query]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / 25) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = useMemo(() => filtered.slice(currentPage * 25, currentPage * 25 + 25), [filtered, currentPage]);
  const visibleIds = new Set(visible.map(n => n.id));
  const visibleEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)).slice(0, 90);
  const selected = Math.max(0, visible.findIndex(n => n.id === selectedId));
  const node = visible[selected];
  const relationships = edges.filter(e => e.source === node?.id || e.target === node?.id);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    function detect() {
      try {
        const context = media.matches ? null : document.createElement("canvas").getContext("webgl2");
        setAvailable(!!context);
        context?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch { setAvailable(false); }
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { detect(); observer.disconnect(); }
    }, { rootMargin: "120px" });
    if (stage.current) observer.observe(stage.current);
    media.addEventListener("change", detect);
    return () => { observer.disconnect(); media.removeEventListener("change", detect); };
  }, []);
  function selectRelated(id: string) {
    setQuery(""); setKind("all");
    const index = nodes.findIndex(n => n.id === id);
    setPage(Math.max(0, Math.floor(index / 25))); setSelectedId(id);
  }
  const fallback = <Fallback nodes={visible} edges={visibleEdges} selected={selected} onSelect={i => setSelectedId(visible[i].id)} />;
  return (
    <div ref={container} className={"architecture-view graph-workbench" + (visible.length <= 5 ? " compact" : "")}>
      <div className="graph-toolbar">
        <label className="graph-search"><Search size={14} /><input aria-label="Search graph files or symbols" placeholder="Find a file or symbol…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
        <select aria-label="Filter graph entity type" value={kind} onChange={e => { setKind(e.target.value); setPage(0); }}>
          <option value="all">All entities</option>
          {[...new Set(nodes.map(n => n.kind))].sort().map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <button className="graph-mode" aria-pressed={flat} onClick={() => setFlat(!flat)}>{flat ? <Box size={14}/> : <Layers size={14}/>} {flat ? "3D view" : "2D view"}</button>
      </div>
      <div className="graph-work-area">
        <div className="graph-wrap" ref={stage}>
          <div className="graph-grid" />
          <span className="graph-label">{conceptual ? "CONCEPTUAL DEMO · NOT YOUR REPOSITORY" : "PINNED REPOSITORY · MODULE PATH MATCHES"}</span>
          <button className="graph-expand" aria-label="Expand code map" onClick={() => {
            setViewError("");
            const action = document.fullscreenElement ? document.exitFullscreen() : container.current?.requestFullscreen();
            void action?.catch(() => setViewError("Fullscreen is unavailable. The map remains interactive here."));
          }}><Maximize2 size={14}/></button>
          {!visible.length ? <div className="graph-no-results" role="status">No entities match. Clear the search or change the filter.</div> :
            <Boundary key={flat ? "flat" : "spatial"} fallback={fallback}>{available && !flat ? <Scene nodes={visible} edges={visibleEdges} selected={selected} onSelect={i => setSelectedId(visible[i].id)} /> : fallback}</Boundary>}
        </div>
        <aside className="module-details" aria-live="polite">
          <span className="eyebrow">{node?.kind || "SELECTION"}{node?.status ? ` / ${node.status}` : ""}</span>
          <strong>{node?.label || "No matching entities"}</strong>
          {node?.path && <code>{node.path}{node.line ? `:${node.line}` : ""}</code>}
          <p>{node?.detail || `${relationships.length} indexed relationships. These are module-path matches, not a resolved call graph.`}</p>
          {node?.path && onOpenSource && <button className="button secondary small" onClick={() => onOpenSource(node.path!, node.line)}>Open pinned source <ArrowRight size={13}/></button>}
          <div className="relationship-list">
            <span className="eyebrow">INCOMING / OUTGOING</span>
            {relationships.slice(0, 40).map((e, i) => {
              const outgoing = e.source === node?.id;
              const target = nodes.find(n => n.id === (outgoing ? e.target : e.source));
              return target && <button key={`${e.source}:${e.target}:${i}`} onClick={() => selectRelated(target.id)}><small>{outgoing ? "OUT" : "IN"} · {e.kind}</small><span>{target.label}</span></button>;
            })}
            {!relationships.length && <p>No relationships in the indexed scope.</p>}
            {relationships.length > 40 && <p>First 40 of {relationships.length} relationships. Use the dependency list for module imports.</p>}
          </div>
        </aside>
      </div>
      <div className="module-controls" aria-label="Select architecture module">{visible.map((n, i) => <button key={n.id} aria-pressed={selected === i} onClick={() => setSelectedId(n.id)}>{n.label}</button>)}</div>
      <div className="graph-pagination"><span>{filtered.length ? currentPage * 25 + 1 : 0}–{Math.min((currentPage + 1) * 25, filtered.length)} of {filtered.length} entities · {visibleEdges.length} visible edges</span><div><button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
      <p className="graph-scope">{flat ? "2D representation" : !available ? "Accessible 2D fallback · WebGL unavailable or reduced motion enabled" : "3D · drag to orbit · controls to pan and fit"}. Selection details include relationships beyond the current page.</p>
      {viewError && <p className="helper" role="status">{viewError}</p>}
    </div>
  );
}
