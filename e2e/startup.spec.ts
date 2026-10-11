import { test, expect } from "@playwright/test";

test("navigation and spatial shell appear before the session response", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/me", async (route) => {
    await held;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Sign in to continue." }),
    });
  });
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Your code. In perspective." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Repositories", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".code-cube")).toBeVisible();
  await expect(page.getByText("Opening your workspace…")).toHaveCount(0);
  await page.screenshot({ path: "test-results/instant-workspace-shell.png" });
  release();
  await expect(page).toHaveURL(/\/login$/);
});

test("temporary backend failure keeps navigation and offers recovery", async ({
  page,
}) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Temporary service interruption." }),
    }),
  );
  await page.goto("/app");
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Temporary service interruption.",
  );
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Temporary service interruption.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("every workspace section opens with a real local session", async ({
  page,
}) => {
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      email: `navigation-${Date.now()}@example.invalid`,
      name: "Navigation smoke test",
      password: "navigation-smoke-passphrase",
    },
  });
  expect(response.status()).toBe(200);
  try {
    for (const path of [
      "/app",
      "/app/repositories",
      "/app/interactions",
      "/app/analyses",
      "/app/findings",
      "/app/tests",
      "/app/usage",
      "/app/settings/providers",
      "/app/settings/policies",
      "/app/settings/team",
      "/app/settings/account",
      "/app/settings/security",
      "/app/settings/audit",
    ]) {
      await page.goto(path);
      await expect(page.locator(".app-content h1").first()).toBeVisible();
      await expect(page.locator(".app-content")).not.toContainText(
        "An internal operation failed",
      );
    }
  } finally {
    const me = await page.request.get("/api/me");
    const profile = await me.json();
    const removed = await page.request.delete("/api/settings/account", {
      headers: {
        Origin: "http://localhost:3000",
        "X-CSRF-Token": profile.csrf,
      },
      data: { confirmation: profile.user.email },
    });
    expect(removed.status()).toBe(200);
  }
});
