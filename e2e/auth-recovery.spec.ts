import { test, expect } from "@playwright/test";

test("social sign-in waits for backend recovery before redirecting", async ({
  page,
}) => {
  let checks = 0;
  let redirects = 0;
  await page.route("**/api/auth/capabilities", (route) =>
    route.fulfill({ json: { google: true, github: true } }),
  );
  await page.route("**/api/ready", (route) => {
    checks++;
    return route.fulfill({
      status: checks === 1 ? 502 : 200,
      json: { ready: checks > 1 },
    });
  });
  await page.route("**/api/auth/oauth/google?*", (route) => {
    redirects++;
    return route.fulfill({
      contentType: "text/html",
      body: "<h1>OAuth redirect reached</h1>",
    });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Preparing secure sign-in",
  );
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "OAuth redirect reached" }),
  ).toBeVisible();
  expect(checks).toBe(2);
  expect(redirects).toBe(1);
});
