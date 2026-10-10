let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response
    .json()
    .catch(() => ({ detail: "The server returned an unreadable response." }));
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The request could not be completed.",
    );
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
