"use client";
import { Component, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArchitectureNode,
  ArchitectureEdge,
  conceptualNodes,
  conceptualEdges,
  positions,
} from "@/lib/architecture";
const Scene = dynamic(() => import("./scene"), { ssr: false });
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
  const points = positions(nodes).map(([x, y]) => [300 + x * 65, 200 - y * 65]);
  return (
    <svg
      className="graph-fallback"
      viewBox="0 0 600 400"
      role="img"
      aria-label="Code architecture dependency map; equivalent module controls below"
    >
      {edges.slice(0, 90).map((e, i) => {
        const a = nodes.findIndex((n) => n.id === e.source),
          b = nodes.findIndex((n) => n.id === e.target);
        return a < 0 || b < 0 ? null : (
          <path
            key={i}
            d={`M${points[a][0]} ${points[a][1]}L${points[b][0]} ${points[b][1]}`}
            stroke="#64607f"
            strokeWidth="1.5"
          />
        );
      })}
      {nodes.map((n, i) => (
        <g key={n.id} onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
          <rect
            x={points[i][0] - 23}
            y={points[i][1] - 23}
            width="46"
            height="46"
            rx={n.kind === "database" ? 20 : 8}
            fill={i === selected ? "#695587" : "#252735"}
            stroke={
              n.status === "risk"
                ? "#d59b65"
                : n.status === "verified"
                  ? "#6fb49b"
                  : "#9a8cb4"
            }
          />
          <text
            x={points[i][0]}
            y={points[i][1] + 39}
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
  const visible = nodes.slice(0, 25);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    function update() {
      try {
        setEnabled(
          !media.matches &&
            !!document.createElement("canvas").getContext("webgl2"),
        );
      } catch {
        setEnabled(false);
      }
    }
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const node = visible[selected] || visible[0];
  const fallback = (
    <Fallback
      nodes={visible}
      edges={edges}
      selected={selected}
      onSelect={setSelected}
    />
  );
  return (
    <div
      className={"architecture-view" + (visible.length <= 5 ? " compact" : "")}
    >
      <div className="graph-wrap">
        <div className="graph-grid" />
        <span className="graph-label">
          {conceptual
            ? "CONCEPTUAL DEMO · NOT YOUR REPOSITORY"
            : "PINNED REPOSITORY · MODULE PATH MATCHES"}
        </span>
        <Boundary fallback={fallback}>
          {enabled ? (
            <Scene
              nodes={visible}
              edges={edges}
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
            `${edges.filter((e) => e.source === node?.id || e.target === node?.id).length} visible relationships. Browse the file for revision-pinned source evidence.`}
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
    </div>
  );
}
