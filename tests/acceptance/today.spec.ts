import { expect, test } from "@playwright/test";

test("A1: launching the app opens Today", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today's thoughts" })).toBeVisible();
});

test("A2: one primary capture box labeled 'What are you thinking?'", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "What are you thinking?" });
  await expect(box).toHaveCount(1);
  await expect(box).toBeVisible();
});

test("A3: capturing with Cmd/Ctrl + Enter puts the thought in the Today stream", async ({ page }) => {
  // Real route, real capture engine and real Claude adapter; only the `claude` executable is a local fake.
  await page.goto("/");
  const text = `Memory might be reconstructable state history ${Date.now()}`;
  const box = page.getByRole("textbox", { name: "What are you thinking?" });
  await box.fill(text);

  const captured = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/capture" && r.request().method() === "POST");
  await box.press("ControlOrMeta+Enter");
  const response = await captured;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.object.content).toBe(text);
  expect(body.enrichment).toMatchObject({ extraction: "ok", houses: "classified" });

  const card = page.getByRole("list", { name: "Today's thoughts" }).getByRole("article").filter({ hasText: text });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading", { name: body.object.title })).toBeVisible();
  await expect(card).toContainText("5 · Creation");
  await expect(box).toHaveValue("");
  await expect(page.getByRole("form", { name: "Capture" }).getByRole("status")).toHaveText("Captured.");

  await page.reload();
  await expect(page.getByRole("list", { name: "Today's thoughts" }).getByRole("article").filter({ hasText: text })).toHaveCount(1);
});

test("A5: selecting a thought changes the constellation anchor", async ({ page }) => {
  await page.goto("/");
  const text = `Retrieval quality may matter more than model size ${Date.now()}`;
  const box = page.getByRole("textbox", { name: "What are you thinking?" });
  await box.fill(text);
  const captured = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/capture" && r.request().method() === "POST");
  await box.press("ControlOrMeta+Enter");
  const body = await (await captured).json();

  // With nothing selected, the anchor is the latest thought today (SPEC §25G).
  const anchorName = page.locator(".constellation__anchor-name");
  await expect(anchorName).toHaveText(body.object.title);

  // Clicking a node on the dial moves the constellation to that thought (SPEC §25G). The last node is
  // painted on top, so it is clickable even when a crowded house sector packs circles together.
  const node = page.locator(".constellation__node").last();
  const nodeLabel = (await node.getAttribute("aria-label"))!;
  const nodeName = nodeLabel.slice(0, nodeLabel.lastIndexOf(" — house"));
  expect(nodeName).not.toBe(body.object.title);
  await node.click();
  await expect(anchorName).toHaveText(nodeName);
  await expect(page).toHaveURL(/\?focus=/);

  // Selecting a thought from the text list does the same.
  const other = page.locator(".constellation__list a").first();
  const otherName = (await other.textContent())!.trim();
  await other.click();
  await expect(anchorName).toHaveText(otherName);

  // And selecting a thought card in the stream anchors on it.
  await page.goto("/");
  const card = page.locator(".stream__list .thought__link").first();
  await card.click();
  await expect(anchorName).toHaveText(body.object.title);
  await expect(page.locator(".thought--selected")).toHaveCount(1);
});

test("selecting a thought keeps text that has not been captured yet", async ({ page }) => {
  await page.goto("/?focus=seed-06");
  const draft = "a half-written thought that must survive navigation";
  const box = page.getByRole("textbox", { name: "What are you thinking?" });
  await box.fill(draft);

  await page.locator(".constellation__list a").first().click();
  await expect(page).toHaveURL(/\?focus=/);
  await expect(box).toHaveValue(draft);

  await page.locator(".constellation__node").last().click();
  await expect(box).toHaveValue(draft);
});

test("the constellation is read and navigated through its text list (SPEC §37)", async ({ page }) => {
  await page.goto("/?focus=seed-06");
  const nodes = page.locator(".constellation__node");
  await expect(nodes.first()).toBeVisible();

  // The dial is a picture: its node links are pointer targets only, never keyboard tab stops.
  expect(await page.locator('.constellation__node[tabindex="-1"]').count()).toBe(await nodes.count());

  // Tabbing out of the stream column lands in the text list, not on an invisible circle.
  await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>(".today__stream a, .today__stream button")].filter((el) => !(el as HTMLButtonElement).disabled);
    controls[controls.length - 1]?.focus();
  });
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest(".constellation__list") !== null)).toBe(true);

  // The relations the dial draws as lines are stated in words beside the thoughts they join.
  if ((await page.locator(".constellation__edge").count()) > 0) {
    const links = page.locator(".constellation__list-links");
    expect(await links.count()).toBeGreaterThan(0);
    await expect(links.first()).toContainText(/supports|contradicts|depends on|causes|derived from|analogous to|contains|requires|answers|questions|extends|supersedes|related to/);
  }
});

test("A6: the constellation shows no more than 12 related nodes", async ({ page }) => {
  const nodes = page.locator(".constellation__node");

  // seed-06 has 15 candidates in the §35 seed, so an uncapped constellation would draw 15 here.
  await page.goto("/?focus=seed-06");
  await expect(nodes.first()).toBeVisible();
  expect(await nodes.count()).toBe(12);
  // The same thoughts are listed as text, so the graph is not the only way to read them (SPEC §37).
  expect(await page.locator(".constellation__list li").count()).toBe(12);

  // And a freshly captured thought stays within the cap.
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "What are you thinking?" });
  await box.fill(`A thought with many neighbours in the seeded graph ${Date.now()}`);
  const captured = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/capture" && r.request().method() === "POST");
  await box.press("ControlOrMeta+Enter");
  await captured;
  await expect(nodes.first()).toBeVisible();
  expect(await nodes.count()).toBeGreaterThan(0);
  expect(await nodes.count()).toBeLessThanOrEqual(12);
});
