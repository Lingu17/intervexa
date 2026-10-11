let csrf = "";
const memory = new Map<string, { data: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
let generation = 0;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function clearApiCache() {
  generation++;
  memory.clear();
  pending.clear();
}
export function cachedValue<T>(path: string): T | undefined {
  const entry = memory.get(path);
  return entry && entry.expires > Date.now() ? (entry.data as T) : undefined;
}
// Short-lived, tab-memory cache only. Never persists credentials or account data.
export function readApi<T>(path: string, refresh = false): Promise<T> {
  const cached = cachedValue<T>(path);
  if (!refresh && cached !== undefined) return Promise.resolve(cached);
  const existing = pending.get(path);
  if (existing) return existing as Promise<T>;
  const started = generation;
  const request = api<T>(path)
    .then((data) => {
      if (started === generation)
        memory.set(path, { data, expires: Date.now() + 15_000 });
      return data;
    })
    .finally(() => {
      if (pending.get(path) === request) pending.delete(path);
    });
  pending.set(path, request);
  return request;
}
export function setCsrf(value: string) {
  csrf = value;
  if (!value) clearApiCache();
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (method !== "GET") clearApiCache();
  let response: Response;
  try {
    response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(path.endsWith("/index") ? 195_000 : path.includes("/verify") || path.includes("/execute") ? 250_000 : path.includes("/generate") || path.includes("/question") || path.includes("/semantic-search") || path.includes("/embeddings") ? 90_000 : 30_000),
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  } catch {
    throw new ApiError("The service could not be reached or timed out. Retry shortly; refresh to check whether your work completed.", 0);
  }
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError(response.status === 502 || response.status === 504 ? "The service is starting or the request timed out. Retry shortly; refresh to check whether your work completed." : "The server returned an unreadable response. Please retry.", response.status); }
  if (!response.ok) {
    if (response.status === 401) clearApiCache();
    throw new ApiError(
      typeof data.detail === "string"
        ? data.detail
        : "The request could not be completed.",
      response.status,
    );
  }
  return data as T;
}
export type Me = {
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string };
  csrf: string;
  github_configured: boolean;
  github_missing?: string[];
  runner_configured: boolean;
  preferences?: { theme: "dark" | "light" };
};
export type Repo = {
  id: string;
  full_name: string;
  default_branch: string;
  pull_requests: number;
  index?: { sha: string; branch: string; created_at: number } | null;
  policy: {
    max_pairs: number;
    retention_days: number;
    advisory: true;
    publish_checks?: boolean;
  };
  pulls?: Pull[];
};
export type Pull = {
  number: number;
  title: string;
  base_sha: string;
  head_sha: string;
  files: { filename: string; patch?: string; status: string }[];
};
export type Analysis = {
  id: string;
  state: string;
  repository: string;
  created_at: number;
  updated_at: number;
  findings: number;
  error?: string;
  coverage?: Record<string, unknown>;
};
export type Reference = {
  kind: string;
  name: string;
  path: string;
  line: number;
  pr: number;
};
export type Case = {
  name: string;
  exit_code: number;
  stdout: string;
  stderr?: string;
  test_count: number;
  timeout?: boolean;
  commit?: string;
};
export type TestResult = {
  id?: string;
  status: string;
  reason?: string;
  cases: Case[];
  artifact_identity?: string;
  merge_order?: number[];
  lockfiles?: Record<string, string>;
};
export type Finding = {
  id: string;
  analysis_id: string;
  analysis_state: string;
  status: string;
  repository: string;
  title: string;
  category: string;
  severity: string;
  risk: number;
  confidence: string;
  prs: number[];
  rationale: string[];
  shared_files: string[];
  identifiers: string[];
  explanation: string;
  references: Reference[];
  contract_changes: unknown[];
  revisions: { pr: number; base: string; head: string }[];
  expected: string;
  actual: string;
  reproduction: string;
  suggested_fix: string;
  verification_reason: string;
  test_source?: string;
  test_result?: TestResult;
};
export type Detail = {
  id: string;
  state: string;
  snapshot: {
    repository: string;
    pulls: Pull[];
    fingerprint?: string;
    merge_strategy?: string;
  };
  coverage: Record<string, unknown>;
  error?: string;
  created_at: number;
  findings: Finding[];
  tests: TestResult[];
};
export type ProviderModel = {
  id: string;
  name: string;
  context_length?: number;
  pricing?: Record<string, string>;
  capabilities?: string[];
};
