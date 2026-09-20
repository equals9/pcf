import { expect, test, type Page } from "@playwright/test";

// SPEC §22 Return card, §24/§25F Tension card, and the frozen A7 and A8 acceptance tests. Every call goes
// through the real routes and engines; only the `claude` executable is a local fake.

let seq = 0;
const unique = (label: string) => `${label} #${Date.now()}-${++seq}`;

const box = (page: Page) => page.getByRole("textbox", { name: "What are you thinking?" });
const returnCard = (page: Page) => page.getByRole("region", { name: "Return" });
const tensionCard = (page: Page) => page.getByRole("region", { name: "Tension" });
const isTodayGet = (url: string, method: string) => new URL(url).pathname === "/api/today" && method === "GET";

async function capture(page: Page, text: string) {
  await box(page).fill(text);
  const captured = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/capture" && r.request().method() === "POST");
  const checked = page.waitForResponse((r) => isTodayGet(r.url(), r.request().method()));
  await box(page).press("ControlOrMeta+Enter");
  const body = await (await captured).json();
  const today = await (await checked).json();
  return { ...body, today };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("A7: reloading the browser preserves previous thoughts", async ({ page }) => {
  const text = unique("a thought that must survive a reload");
  await capture(page, text);
  const card = page.getByRole("list", { name: "Today's thoughts" }).getByRole("article").filter({ hasText: text });
  await expect(card).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole("list", { name: "Today's thoughts" }).getByRole("article").filter({ hasText: text })).toHaveCount(1);

  // And again in a fresh browser context, so nothing depends on client state.
  const second = await page.context().browser()!.newPage();
  await second.goto(page.url());
  await expect(second.getByRole("list", { name: "Today's thoughts" }).getByRole("article").filter({ hasText: text })).toHaveCount(1);
  await second.close();
});

test("A8: Today shows at most one resurfaced card and one tension card", async ({ page }) => {
  await capture(page, unique("pcf-e2e-claim memory belongs outside the weights"));
  await capture(page, unique("pcf-e2e-claim memory belongs inside the weights"));
  await page.reload();

  expect(await returnCard(page).count()).toBeLessThanOrEqual(1);
  expect(await tensionCard(page).count()).toBeLessThanOrEqual(1);
  expect(await page.locator(".return__card").count()).toBeLessThanOrEqual(1);
  expect(await page.locator(".tension__card").count()).toBeLessThanOrEqual(1);
});

test("§22: an old thought returns, with its age and why it returned", async ({ page }) => {
  // The acceptance database is seeded with §35 objects, all older than today.
  const card = returnCard(page);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Why this returned:");
  await expect(card.getByRole("link", { name: "Open" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Useful" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Dismiss" })).toBeVisible();
  await expect(card).toContainText(/ago|yesterday/);
});

test("§22: the same thought returns on reload, and dismissing it keeps it away", async ({ page }) => {
  const first = await returnCard(page).locator(".return__excerpt").textContent();
  await page.reload();
  expect(await returnCard(page).locator(".return__excerpt").textContent()).toBe(first);

  const feedback = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/feedback" && r.request().method() === "POST");
  await returnCard(page).getByRole("button", { name: "Dismiss" }).click();
  expect((await feedback).status()).toBe(200);
  await expect(returnCard(page)).toHaveCount(0);

  await page.reload();
  const after = await returnCard(page).count();
  if (after === 1) {
    expect(await returnCard(page).locator(".return__excerpt").textContent()).not.toBe(first);
  }
});

test("§22: Useful is recorded without changing the thought", async ({ page }) => {
  const card = returnCard(page);
  const excerpt = await card.locator(".return__excerpt").textContent();
  const feedback = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/feedback" && r.request().method() === "POST");
  await card.getByRole("button", { name: "Useful" }).click();
  const body = await (await feedback).json();
  expect(body).toMatchObject({ targetType: "object", action: "useful" });
  await expect(card.getByText("Thanks — recorded.")).toBeVisible();
  expect(await card.locator(".return__excerpt").textContent()).toBe(excerpt);
});

test("§24: two conflicting claims surface one tension, and dismissing it sticks", async ({ page }) => {
  await capture(page, unique("pcf-e2e-claim personal AI memory should remain outside model weights"));
  await capture(page, unique("pcf-e2e-claim personal AI memory should live inside model weights"));

  const card = tensionCard(page);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("These cannot both hold");
  await expect(card).toContainText("Claim A");
  await expect(card).toContainText("Claim B");
  await expect(card).toContainText(/model weights|the weights/);
  // §25F is two actions only, and the note must not claim the shown claims are the user's own wording.
  await expect(card.getByRole("button", { name: "Open both" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Not a conflict" })).toBeVisible();
  await expect(card.locator(".tension__card p a, .tension__card button")).toHaveCount(2);
  await expect(card).toContainText("The thoughts themselves are unchanged.");

  // "Open both" opens both source thoughts, exactly as they were captured.
  await expect(card.locator(".tension__source")).toHaveCount(0);
  await card.getByRole("button", { name: "Open both" }).click();
  await expect(card.locator(".tension__source")).toHaveCount(2);
  // The surfaced tension may be any recorded pair, so assert the shape: two non-empty captured thoughts.
  for (const source of await card.locator(".tension__source-content").all()) {
    expect((await source.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
  }

  // The same tension survives a reload: it is replayed from recorded verdicts, not recomputed.
  const shown = (await card.locator(".tension__claims").textContent())!;
  await page.reload();
  expect(await tensionCard(page).locator(".tension__claims").textContent()).toBe(shown);

  const dismissal = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/feedback" && r.request().method() === "POST");
  await tensionCard(page).getByRole("button", { name: "Not a conflict" }).click();
  expect((await dismissal).status()).toBe(200);

  // That pair never comes back, whatever other tensions exist.
  await page.reload();
  const after = await tensionCard(page).count();
  if (after === 1) {
    expect(await tensionCard(page).locator(".tension__claims").textContent()).not.toBe(shown);
  }
});

test("§24: claims classified as no tension surface no card", async ({ page }) => {
  await capture(page, unique("pcf-e2e-claim pcf-e2e-no-tension tomatoes need more sun than shade"));
  const second = await capture(page, unique("pcf-e2e-claim pcf-e2e-no-tension basil prefers a warm windowsill"));

  // The check really ran on the second thought — otherwise "no card" would prove nothing.
  expect(second.today.checked).toBe(second.object.id);
  await page.reload();
  const card = tensionCard(page);
  if (await card.count()) {
    await expect(card).not.toContainText("tomatoes");
    await expect(card).not.toContainText("basil");
  }
});

test("the tension check keeps the capture draft and the constellation focus", async ({ page }) => {
  await capture(page, unique("pcf-e2e-claim the first claim in this pair"));
  await page.locator(".stream__list .thought__link").first().click();
  await expect(page).toHaveURL(/\?focus=/);
  const focusUrl = page.url();
  const anchor = await page.locator(".constellation__anchor-name").textContent();

  await capture(page, unique("pcf-e2e-claim the second claim in this pair"));
  const draft = "a draft written while the tension check runs";
  await box(page).fill(draft);
  await page.waitForTimeout(500);

  await expect(box(page)).toHaveValue(draft);
  expect(page.url()).toBe(focusUrl);
  await expect(page.locator(".constellation__anchor-name")).toHaveText(anchor!);
});

test("a failed Useful is not reported as recorded", async ({ page }) => {
  await page.route("**/api/feedback", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  const card = returnCard(page);
  await card.getByRole("button", { name: "Useful" }).click();
  await expect(card.getByText("Couldn't record that.")).toBeVisible();
  await expect(card.getByText("Thanks — recorded.")).toHaveCount(0);
  await expect(card).toBeVisible();
});

test("a capture made while the tension check runs is still checked", async ({ page }) => {
  const checks: unknown[] = [];
  await page.route("**/api/today", async (route) => {
    // Hold the first check open long enough for a second capture to land during it.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const response = await route.fetch();
    const body = await response.json();
    checks.push(body.checked);
    await route.fulfill({ response, body: JSON.stringify(body) });
  });

  for (const text of [unique("pcf-e2e-claim the earlier half of a pair"), unique("pcf-e2e-claim the later half of a pair")]) {
    await box(page).fill(text);
    const captured = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/capture" && r.request().method() === "POST");
    await box(page).press("ControlOrMeta+Enter");
    expect((await captured).status()).toBe(200);
  }

  // Both thoughts get their own §24 pass: the second is queued, never dropped.
  await expect.poll(() => checks.length, { timeout: 15_000 }).toBe(2);
  await page.unroute("**/api/today");
});

test("reloading Today never requests /api/today, so a reload can never reach Claude", async ({ page }) => {
  // Reloads render the page from local state (TodayView calls the engines directly). Only a confirmed
  // capture asks GET /api/today, which is the one route that may classify claims.
  const todayRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/today") todayRequests.push(request.method());
  });
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByRole("textbox", { name: "What are you thinking?" })).toBeVisible();
  }
  await page.goto("/");
  await page.locator(".stream__list .thought__link").first().click();
  await expect(page).toHaveURL(/\?focus=/);
  expect(todayRequests).toEqual([]);
});

test("GET /api/today refuses a request addressed to another host", async ({ page }) => {
  const res = await page.request.get("/api/today", { headers: { host: "rebind.attacker.example:3211" } });
  expect(res.status()).toBe(403);
  expect(await res.json()).toMatchObject({ error: "forbidden" });
});
