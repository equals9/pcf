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
