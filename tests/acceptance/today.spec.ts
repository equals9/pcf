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
