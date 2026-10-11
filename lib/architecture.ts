export type ArchitectureNode = {
  id: string;
  label: string;
  kind: string;
  detail?: string;
  status?: string;
  path?: string;
  line?: number;
};
export type ArchitectureEdge = { source: string; target: string; kind: string; line?: number };
export const conceptualNodes: ArchitectureNode[] = [
  {
    id: "repository",
    label: "repository / main",
    kind: "repository",
    detail: "Conceptual repository core. Select a module to trace its role.",
  },
  {
    id: "api",
    label: "sessions/api.py",
    kind: "api",
    detail: "API boundary: returns a session dictionary.",
  },
  {
    id: "service",
    label: "authentication",
    kind: "service",
    detail: "Service coordinating identity and session creation.",
  },
  {
    id: "database",
    label: "session_store",
    kind: "database",
    detail: "Session persistence. Cylinder denotes a data boundary.",
  },
  {
    id: "function",
    label: "create_session()",
    kind: "function",
    detail: "Shared return-value contract between producer and caller.",
    status: "shared",
  },
  {
    id: "file",
    label: "client/login.py",
    kind: "file",
    detail: "Consumer of the shared session interface.",
  },
  {
    id: "pr-a",
    label: "PR A / rename token",
    kind: "pull-request",
    detail: "Example change: producer returns session_id rather than token.",
    status: "change",
  },
  {
    id: "pr-b",
    label: "PR B / new consumer",
    kind: "pull-request",
    detail: "Example change: adds a consumer that expects token.",
    status: "change",
  },
  {
    id: "risk",
    label: "contract intersection",
    kind: "interface",
    detail:
      "The new consumer and changed producer disagree in the combined state.",
    status: "risk",
  },
  {
    id: "test",
    label: "combined regression",
    kind: "test",
    detail:
      "Illustrated comparison: baseline and individuals pass; combined assertion fails twice. Demo, not a finding from your repository.",
    status: "verified",
  },
];
export const conceptualEdges: ArchitectureEdge[] = [
  ...["api", "service", "database", "file"].map((target) => ({
    source: "repository",
    target,
    kind: "contains",
  })),
  { source: "service", target: "database", kind: "stores" },
  { source: "api", target: "function", kind: "calls" },
  { source: "file", target: "function", kind: "consumes" },
  { source: "pr-a", target: "function", kind: "changes" },
  { source: "pr-b", target: "file", kind: "changes" },
  { source: "function", target: "risk", kind: "shared contract" },
  { source: "file", target: "risk", kind: "expects token" },
  { source: "risk", target: "test", kind: "verified by" },
];
export function positions(
  nodes: ArchitectureNode[],
): [number, number, number][] {
  return nodes.map((_, i) => {
    if (!i) return [0, 0, 0];
    const ring = Math.ceil(i / 10);
    const angle =
      (((i - 1) % 10) * Math.PI * 2) / Math.min(nodes.length - 1, 10);
    return [
      Math.cos(angle) * (2.4 + (ring - 1) * 1.3),
      Math.sin(angle) * (1.65 + (ring - 1) * 0.75),
      Math.sin(angle * 2) * 0.6,
    ];
  });
}
