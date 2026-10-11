import { test, expect } from "@playwright/test";

test("premium public layout and mobile navigation work at all required widths", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your code has a structure/ })).toBeVisible();
  await expect(page.locator(".product-proof")).toContainText("ILLUSTRATIVE PRODUCT PREVIEW");
  await expect(page.locator(".hero-system .architecture-view")).toHaveCount(1);
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    if (width <= 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.locator("#public-navigation").getByRole("link", { name: "Pricing" })).toBeVisible();
      await page.getByRole("button", { name: "Close navigation" }).click();
    }
    await page.screenshot({ path: `test-results/premium-home-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator("#public-navigation").getByRole("link", { name: "Pricing" }).click();
  await expect(page).toHaveURL(/\/pricing$/);
});

test("graph search, paging, type filters, relationship traversal and pinned source work", async ({ page }) => {
  const registration = await page.request.post("/api/auth/register", { headers: { Origin: "http://localhost:3000" }, data: { email: `graph-${Date.now()}@gmail.com`, name: "Graph QA", password: "secure-graph-test-password" } });
  expect(registration.status()).toBe(200);
  const sha = "d".repeat(40);
  const files = Array.from({length:30}, (_, i) => ({ id:`module${i}.py`, label:`module${i}.py`, kind:"file", path:`module${i}.py` }));
  const nodes = [{id:"repository",label:"main",kind:"repository"}, ...files, {id:"function",label:"create_session",kind:"function",path:"module29.py",line:2}];
  await page.route("**/api/repositories/graph-fixture/**", route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("/file") ? {path:"module29.py",sha,source:"# pinned fixture\ndef create_session(): return 1",symbols:[{name:"create_session",line:2,kind:"function"}],issues:[],imports:[]} : { sha,branch:"main",created_at:1000,coverage:{indexed_files:30},files:files.map(f=>({path:f.path,symbols:[],imports:[],issues:[]})),graph:{nodes,edges:[{source:"module29.py",target:"function",kind:"declares"}],notice:"Controlled AST fixture"} } });
  });
  await page.goto("/app/repositories/graph-fixture/explore");
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await page.locator(".module-controls").getByRole("button",{name:"module29.py",exact:true}).click();
  await expect(page.locator(".module-details")).toContainText("OUT · declares");
  await page.locator(".relationship-list").getByRole("button",{name:/create_session/}).click();
  await expect(page.locator(".module-details > code")).toHaveText("module29.py:2");
  await page.getByLabel("Filter graph entity type").selectOption("function");
  await expect(page.locator(".module-controls button")).toHaveCount(1);
  await page.getByLabel("Search graph files or symbols").fill("missing");
  await expect(page.getByRole("status").filter({hasText:"No entities match"})).toBeVisible();
  await page.getByLabel("Search graph files or symbols").fill("create_session");
  await page.getByRole("button",{name:"2D view",exact:true}).click();
  await expect(page.getByRole("button",{name:"3D view",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Open pinned source"}).click();
  await expect(page.locator(".source-code")).toContainText("def create_session");
  for (const width of [1440,1280,768,390]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test("unreadable successful API responses show recovery instead of fake success", async ({ page }) => {
  await page.route("**/api/me", route => route.fulfill({status:200,contentType:"application/json",body:"invalid-json"}));
  await page.goto("/app");
  await expect(page.getByRole("alert").filter({hasText:"unreadable response"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Retry connection"})).toBeVisible();
});
