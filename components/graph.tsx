"use client";
import { Component, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2 } from "lucide-react";
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
export function Graph({
  nodes = conceptualNodes,
  edges = conceptualEdges,
  conceptual = true,
}: {
  nodes?: ArchitectureNode[];
  edges?: ArchitectureEdge[];
  conceptual?: boolean;
}) {
  const [enabled, setEnabled] = useState(false),
    [selected, setSelected] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [viewError, setViewError] = useState("");
  const visible = nodes.slice(0, 25);
  const visibleIds = new Set(visible.map((node) => node.id));
  const visibleEdges = edges
    .filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    )
    .slice(0, 90);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    function update() {
      try {
        const context = media.matches
          ? null
          : document.createElement("canvas").getContext("webgl2");
        setEnabled(!!context);
        context?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        setEnabled(false);
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          update();
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    if (stage.current) observer.observe(stage.current);
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);
  const node = visible[selected] || visible[0];
  const fallback = (
    <Fallback
      nodes={visible}
      edges={visibleEdges}
      selected={selected}
      onSelect={setSelected}
    />
  );
  return (
    <div
      ref={container}
      className={"architecture-view" + (visible.length <= 5 ? " compact" : "")}
    >
      <div className="graph-wrap" ref={stage}>
        <div className="graph-grid" />
        <span className="graph-label">
          {conceptual
            ? "CONCEPTUAL DEMO · NOT YOUR REPOSITORY"
            : "PINNED REPOSITORY · MODULE PATH MATCHES"}
        </span>
        <button
          className="graph-expand"
          aria-label="Expand code map"
          onClick={() => {
            setViewError("");
            const action = document.fullscreenElement
              ? document.exitFullscreen()
              : container.current?.requestFullscreen();
            void action?.catch(() =>
              setViewError(
                "Fullscreen is unavailable in this browser. The map remains interactive here.",
              ),
            );
          }}
        >
          <Maximize2 size={14} />
        </button>
        <Boundary fallback={fallback}>
          {enabled ? (
            <Scene
              nodes={visible}
              edges={visibleEdges}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            fallback
          )}
        </Boundary>
      </div>
      <div className="module-details" aria-live="polite">
        <span className="eyebrow">
          {node?.kind} {node?.status ? ` / ${node.status}` : ""}
        </span>
        <strong>{node?.label || "No modules indexed"}</strong>
        <p>
          {node?.detail ||
            `${visibleEdges.filter((e) => e.source === node?.id || e.target === node?.id).length} visible relationships. Browse the file for revision-pinned source evidence.`}
        </p>
      </div>
      <div className="module-controls" aria-label="Select architecture module">
        {visible.map((n, i) => (
          <button
            key={n.id}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            {n.label}
          </button>
        ))}
      </div>
      {nodes.length > 25 && (
        <p className="helper">
          Showing 25 of {nodes.length} modules. The dependency list contains the
          full indexed graph.
        </p>
      )}
      {viewError && (
        <p className="helper" role="status">
          {viewError}
        </p>
      )}
    </div>
  );
}
