import { test, expect } from "@playwright/test";

test("public information architecture, meaningful demo and responsive contact", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "A + B", exact: true }).click();
  await expect(
    page.getByText("FAIL · incompatible combined contract"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "create_session()", exact: true })
    .click();
  await expect(
    page.getByText("Shared return-value contract between producer and caller."),
  ).toBeVisible();
  for (const path of [
    "product",
    "repository-intelligence",
    "pr-analysis",
    "how-it-works",
    "security",
    "supported",
    "docs",
    "faq",
    "contact",
    "privacy",
    "terms",
    "acceptable-use",
    "status",
    "forgot-password",
  ]) {
    await page.goto("/" + path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.goto("/contact");
  await page.getByLabel("Name", { exact: true }).fill("Browser contact test");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-contact@example.com");
  await page
    .getByLabel("Message", { exact: true })
    .fill(
      "Clearly identified local browser test submission for contact persistence.",
    );
  await page.getByRole("button", { name: "Submit message" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.screenshot({
    path: "test-results/contact-mobile.png",
    fullPage: true,
  });
  await page.route("**/api/contact", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Contact database temporarily unavailable.",
      }),
    }),
  );
  await page.getByLabel("Name", { exact: true }).fill("Failure test");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-contact@example.com");
  await page
    .getByLabel("Message", { exact: true })
    .fill(
      "Controlled failure response must never show a successful submission.",
    );
  await page.getByRole("button", { name: "Submit message" }).click();
  await expect(page.locator(".contact-form").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("sign-in remains reachable on phones and tablets", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("repository explorer uses pinned source and actual supplied graph, with controlled GitHub fixtures", async ({
  page,
}) => {
  const registration = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      email: `explorer-browser-${Date.now()}@gmail.com`,
      name: "Explorer",
      password: "explorer-browser-passphrase",
    },
  });
  expect(registration.status()).toBe(200);
  const sha = "c".repeat(40);
  const file = {
    path: "auth.py",
    sha,
    source:
      "from store import save\ndef create_session():\n    return save()\n",
    symbols: [{ name: "create_session", kind: "function", line: 2 }],
    imports: [{ module: "store", line: 1 }],
    issues: [],
  };
  await page.route("**/api/repositories/fixture-repo/**", async (route) => {
    const url = new URL(route.request().url());
    const data = url.pathname.endsWith("/intelligence")
      ? {
          sha,
          branch: "main",
          created_at: 1000000000,
          coverage: { indexed_files: 1, parser: "Python AST" },
          files: [file],
          graph: {
            nodes: [
              { id: "repository", label: "main", kind: "repository" },
              { id: "auth.py", label: "auth.py", kind: "file" },
            ],
            edges: [
              { source: "repository", target: "auth.py", kind: "contains" },
            ],
            notice: "Fixture import graph",
          },
        }
      : url.pathname.endsWith("/file")
        ? file
        : {
            results: [
              {
                path: file.path,
                line: 1,
                end_line: 3,
                excerpt: file.source,
                sha,
                score: 9,
              },
            ],
            notice: "Controlled lexical fixture",
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/app/repositories/fixture-repo/explore");
  await expect(
    page.getByRole("heading", { name: "Explore the codebase" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await page.getByRole("button", { name: /auth.py 1 symbols/ }).click();
  await expect(page.locator(".source-code")).toContainText("return save()");
  await expect(
    page.getByRole("link", { name: "create_session:2" }),
  ).toHaveAttribute("href", "#line-2");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByLabel("Search filenames, symbols and identifiers")
    .fill("create_session");
  await page
    .locator(".search-input")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "auth.py:1–3" })).toBeVisible();
  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  await expect(
    page.getByText("PINNED REPOSITORY · MODULE PATH MATCHES"),
  ).toBeVisible();
  await expect(
    page.getByText("CONCEPTUAL DEMO · NOT YOUR REPOSITORY"),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/repository-architecture-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Search workspace" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Search pages and connected repositories")
    .fill("profile");
  await page.getByRole("link", { name: /Profile and data/ }).click();
  await expect(page.getByLabel("Display name")).toHaveValue("Explorer");
  await page.getByLabel("Display name").fill("Explorer Updated");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page.getByRole("button", { name: "Toggle light theme" }).click();
  await expect(page.locator(".app-shell.light")).toBeVisible();
  await page.reload();
  await expect(page.locator(".app-shell.light")).toBeVisible();
  await page.goto("/app/usage");
  await expect(
    page.getByRole("heading", { name: "Usage & limits" }),
  ).toBeVisible();
  await expect(page.getByText("Indexed files per repository")).toBeVisible();
});
