import { test, expect } from "@playwright/test";
import type { Finding } from "../lib/api";

test("marketing, branding and static fallback render on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your code has a structure/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Intervexa", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Code architecture dependency/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: /Open your workspace/ }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  for (const route of ["/features", "/architecture", "/pricing"]) {
    await page.goto(route);
    await expect(page.getByRole("heading").first()).toBeVisible();
  }
});

test("analysis progress, pinned finding evidence and disconnected execution with controlled API fixtures", async ({
  page,
}) => {
  const registration = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      email: `analysis-browser-${Date.now()}@example.com`,
      name: "Analysis Engineer",
      password: "analysis-browser-passphrase",
    },
  });
  expect(registration.status()).toBe(200);
  const pulls = [1, 2].map((number) => ({
    number,
    title: `Controlled change ${number}`,
    base_sha: "a".repeat(40),
    head_sha: String(number).repeat(40),
    files: [{ filename: "auth.py", status: "modified" }],
  }));
  const repo = {
    id: "controlled-repo",
    full_name: "controlled/repository",
    default_branch: "main",
    pull_requests: 2,
    pulls,
    policy: { max_pairs: 10, retention_days: 30, advisory: true },
  };
  const finding: Finding = {
    id: "controlled-finding",
    analysis_id: "controlled-run",
    analysis_state: "inconclusive",
    status: "suspected",
    repository: repo.full_name,
    title: "Potential interaction between PR #1 and PR #2",
    category: "authentication",
    severity: "high",
    risk: 75,
    confidence: "medium",
    prs: [1, 2],
    rationale: [
      "Shared changed files",
      "Shared changed identifiers; resolution unverified",
    ],
    shared_files: ["auth.py"],
    identifiers: ["login", "session"],
    explanation:
      "Controlled test fixture: two changes share an authentication response contract.",
    references: [
      { kind: "function", name: "login", path: "auth.py", line: 1, pr: 1 },
    ],
    contract_changes: [{ type: "response-keys", removed: ["token"] }],
    revisions: pulls.map((p) => ({
      pr: p.number,
      base: p.base_sha,
      head: p.head_sha,
    })),
    expected: "Login preserves the response contract.",
    actual: "No execution evidence yet.",
    reproduction: "Compare baseline, each PR and the combined state twice.",
    suggested_fix: "Review the response consumer.",
    verification_reason: "Static evidence only.",
  };
  let polls = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path === "/api/repositories") data = [repo];
    else if (path === "/api/repositories/controlled-repo") data = repo;
    else if (path === "/api/repositories/controlled-repo/sync")
      data = { count: 2 };
    else if (path === "/api/repositories/controlled-repo/analyses")
      data = { id: "controlled-run" };
    else if (path === "/api/analyses/controlled-run")
      data = {
        id: "controlled-run",
        state: ++polls === 1 ? "analyzing" : "inconclusive",
        snapshot: {
          repository: repo.full_name,
          pulls,
          merge_strategy: "ordered no-fast-forward merges",
        },
        coverage: { supported_languages: ["Python"], unsupported_files: [] },
        findings: polls === 1 ? [] : [finding],
        tests: [
          {
            status: "inconclusive",
            reason: "No isolated runner configured.",
            cases: [],
          },
        ],
        created_at: Date.now() / 1000,
      };
    else if (path === "/api/findings/controlled-finding") data = finding;
    else if (path === "/api/findings") data = [finding];
    else {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/app/repositories/controlled-repo");
  await expect(
    page.getByRole("heading", { name: repo.full_name }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sync PRs" }).click();
  await expect(
    page.getByText("Synchronized 2 open pull requests."),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Select PR 1" }).check();
  await page.getByRole("checkbox", { name: "Select PR 2" }).check();
  await page.getByRole("button", { name: "Analyze selected (2)" }).click();
  await expect(
    page.getByRole("heading", { name: "Integration analysis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Potential interaction between/ }),
  ).toBeVisible({ timeout: 10000 });
  await page
    .getByRole("link", { name: /Potential interaction between/ })
    .click();
  await expect(
    page.getByRole("heading", { name: finding.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Source references and contract evidence",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "auth.py:1" })).toHaveAttribute(
    "href",
    /1{40}\/auth.py#L1/,
  );
  await expect(
    page.getByRole("button", { name: "Run isolated comparison" }),
  ).toBeDisabled();
  await page.goto("/app/interactions");
  await expect(page.locator(".interaction-evidence")).toContainText("2 shared changed identifiers");
  await expect(page.locator(".interaction-pr").first()).toHaveAttribute("href", "https://github.com/controlled/repository/pull/1");
  await page.locator(".interaction-conclusion").click();
  await expect(page.getByRole("heading", { name: finding.title })).toBeVisible();
  await page.screenshot({
    path: "test-results/finding-desktop.png",
    fullPage: true,
  });
});

test("3D illustration renders or falls back without navigation errors", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Create your workspace" }).first(),
  ).toBeVisible();
  const available = await page.evaluate(
    () => !!document.createElement("canvas").getContext("webgl2"),
  );
  if (available) {
    await expect(page.locator(".graph-wrap canvas")).toBeVisible();
    for (const name of ["Pan left", "Pan up", "Zoom in", "Fit graph to view"]) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    await page.screenshot({
      path: "test-results/landing-3d.png",
      fullPage: true,
    });
  } else
    await expect(
      page.getByRole("img", { name: /Code architecture dependency/ }),
    ).toBeVisible();
  expect(errors).toEqual([]);
});

test("authentication, protected empty workspace, provider errors and logout", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByRole("link", { name: "Create a workspace", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Browser Engineer");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`browser-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-browser-test-passphrase");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace, Browser" }),
  ).toBeVisible();
  await expect(page.getByText("Bring a codebase into focus.")).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Repositories", exact: true }).click();
  await expect(page.getByText("Connect your first repository")).toBeVisible();
  await expect(page.getByText(/credentials are not configured/)).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your AI provider" }),
  ).toBeVisible();
  await page
    .getByLabel("API key", { exact: true })
    .fill("private-browser-fixture");
  await page.route("**/api/providers/test", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Invalid provider credential." }),
    }),
  );
  await page.getByRole("button", { name: /Test connection/ }).click();
  await expect(page.getByText("Invalid provider credential.")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page.screenshot({
    path: "test-results/providers-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Security", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Account sessions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revoke other sessions" }).click();
  await expect(page.getByText("Other account sessions revoked.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace, Browser" }),
  ).toBeVisible();
  await expect(page.locator(".sidebar.open")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
