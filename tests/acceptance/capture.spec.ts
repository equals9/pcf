import { expect, test, type Page } from "@playwright/test";

// Capture failure behaviour through the real route and engine. The fake `claude` CLI on the test server's
// PATH fails a stage when the captured thought contains that stage's marker (tests/fixtures/e2e-bin/claude).

let seq = 0;
const unique = (label: string) => `${label} #${Date.now()}-${++seq}`;

const box = (page: Page) => page.getByRole("textbox", { name: "What are you thinking?" });
const status = (page: Page) => page.getByRole("form", { name: "Capture" }).getByRole("status");
const cards = (page: Page) => page.getByRole("article");
const cardFor = (page: Page, text: string) => page.getByRole("list", { name: "Today's thoughts" }).getByRole("article").filter({ hasText: text });
const isCapturePost = (url: string, method: string) => new URL(url).pathname === "/api/capture" && method === "POST";

async function capture(page: Page, text: string) {
  await box(page).fill(text);
  const response = page.waitForResponse((r) => isCapturePost(r.url(), r.request().method()));
  await box(page).press("ControlOrMeta+Enter");
  const res = await response;
  return { status: res.status(), body: await res.json() };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("extraction failure still shows the captured thought", async ({ page }) => {
  const text = unique("pcf-e2e-extract-invalid a thought whose extraction fails");
  const res = await capture(page, text);
  expect(res.status).toBe(200);
  expect(res.body.enrichment).toEqual({ extraction: "failed", houses: "classified", relations: expect.any(String) });

  const card = cardFor(page, text);
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading")).toHaveCount(0);
  await expect(card).toContainText("5 · Creation");
  await expect(box(page)).toHaveValue("");
  await expect(status(page)).toHaveText(/^Captured\. Its title and concepts couldn't be extracted right now\./);
});

test("house classification failure shows the thought with the fallback houses", async ({ page }) => {
  const text = unique("pcf-e2e-houses-invalid a thought whose houses fail");
  const res = await capture(page, text);
  expect(res.status).toBe(200);
  expect(res.body.enrichment.houses).toBe("fallback");
  expect(res.body.houseVector).toMatchObject({ "3": 0.5, "5": 0.5, "9": 0.5, "1": 0 });

  const card = cardFor(page, text);
  await expect(card).toHaveCount(1);
  // §13 fallback ties Houses 3, 5 and 9; §21 gives the tie to the lowest house.
  await expect(card).toContainText("3 · Expression");
  await expect(card.getByRole("heading")).toBeVisible();
  await expect(box(page)).toHaveValue("");
  await expect(status(page)).toHaveText("Captured. Its houses couldn't be classified, so neutral defaults were used.");
});

test("relation inference failure does not make the capture look failed", async ({ page }) => {
  await capture(page, unique("an earlier thought that can become a candidate"));
  const text = unique("pcf-e2e-relations-invalid a thought whose relations fail");
  const res = await capture(page, text);
  expect(res.status).toBe(200);
  expect(res.body.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "failed" });

  const card = cardFor(page, text);
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading", { name: res.body.object.title })).toBeVisible();
  await expect(box(page)).toHaveValue("");
  await expect(status(page)).toHaveText("Captured. Related thoughts couldn't be suggested right now.");
});

test("with Claude unavailable, the thought is still captured and shown", async ({ page }) => {
  const text = unique("pcf-e2e-unavailable a thought captured during an outage");
  const res = await capture(page, text);
  expect(res.status).toBe(200);
  expect(res.body.enrichment).toEqual({ extraction: "failed", houses: "fallback", relations: "skipped" });

  const card = cardFor(page, text);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("3 · Expression");
  await expect(box(page)).toHaveValue("");
  await expect(status(page)).toHaveText(/^Captured\. /);
});

test("an invalid request creates no thought", async ({ page }) => {
  const before = await cards(page).count();

  const api = page.request;
  const json = { "content-type": "application/json" };
  for (const body of [{ content: "   " }, {}, { content: 42 }, [], "text", null]) {
    const res = await api.post("/api/capture", { headers: json, data: JSON.stringify(body) });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_request", saved: false });
  }
  const malformed = await api.post("/api/capture", { headers: json, data: '{"content": ' });
  expect(malformed.status()).toBe(400);
  const plain = await api.post("/api/capture", { headers: { "content-type": "text/plain" }, data: JSON.stringify({ content: "plain text body" }) });
  expect(plain.status()).toBe(415);

  // A blank capture from the box sends nothing.
  const posts: string[] = [];
  page.on("request", (r) => {
    if (isCapturePost(r.url(), r.method())) posts.push(r.url());
  });
  await box(page).fill("   \n  ");
  await box(page).press("ControlOrMeta+Enter");
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(status(page)).toHaveText("");
  await expect(box(page)).toHaveValue("   \n  ");

  await page.reload();
  await expect(cards(page)).toHaveCount(before);
  expect(posts).toEqual([]);
});

test("repeated submits during a capture create one thought", async ({ page }) => {
  const text = unique("pcf-e2e-slow a thought submitted many times");
  const posts: string[] = [];
  page.on("request", (r) => {
    if (isCapturePost(r.url(), r.method())) posts.push(r.url());
  });

  await box(page).fill(text);
  const response = page.waitForResponse((r) => isCapturePost(r.url(), r.request().method()));
  await box(page).press("ControlOrMeta+Enter");
  await box(page).press("ControlOrMeta+Enter");
  await expect(status(page)).toHaveText("Capturing…");
  // SPEC §25B: the text stays in the box until the server confirms it is stored.
  await expect(box(page)).toHaveValue(text);
  await expect(box(page)).toHaveAttribute("readonly", "");
  const button = page.getByRole("button", { name: "Capture" });
  await expect(button).toBeDisabled();
  await box(page).press("ControlOrMeta+Enter");
  await button.click({ force: true });
  await box(page).press("ControlOrMeta+Enter");

  expect((await response).status()).toBe(200);
  await expect(status(page)).toHaveText("Captured.");
  await expect(cardFor(page, text)).toHaveCount(1);
  await expect(box(page)).toHaveValue("");
  await expect(button).toBeEnabled();
  expect(posts).toHaveLength(1);

  await page.reload();
  await expect(cardFor(page, text)).toHaveCount(1);
});

test.describe("client handling of responses it cannot fully trust (intercepted responses)", () => {
  test("keeps the text when the server says nothing was saved", async ({ page }) => {
    await page.route("**/api/capture", (route) =>
      route.fulfill({ status: 500, json: { error: "capture_not_saved", message: "Your thought could not be saved.", saved: false } }),
    );
    const text = unique("a thought the server could not save");
    await box(page).fill(text);
    await box(page).press("ControlOrMeta+Enter");
    await expect(status(page)).toHaveText("Couldn't save this thought. Your text is still here.");
    await expect(box(page)).toHaveValue(text);
    await expect(box(page)).not.toHaveAttribute("readonly");
  });

  test("keeps the text, without claiming a loss, when the server cannot be reached", async ({ page }) => {
    // Everything after the page load fails, as when the server has stopped: the capture and any page refresh.
    await page.route("**/*", (route) => route.abort("connectionrefused"));
    await page.evaluate(() => ((window as unknown as { pcfLoaded: boolean }).pcfLoaded = true));
    const text = unique("a thought whose response never arrives");
    await box(page).fill(text);
    await box(page).press("ControlOrMeta+Enter");
    await expect(status(page)).toHaveText(/^Couldn't confirm this capture\. Your text is still here/);
    await page.waitForTimeout(1000);
    await expect(box(page)).toHaveValue(text);
    expect(await page.evaluate(() => (window as unknown as { pcfLoaded?: boolean }).pcfLoaded)).toBe(true);
  });

  test("clears the text when the server says the thought was saved but could not finish", async ({ page }) => {
    await page.route("**/api/capture", (route) =>
      route.fulfill({ status: 500, json: { error: "capture_saved_incomplete", message: "saved", saved: true, objectId: "x" } }),
    );
    await box(page).fill(unique("a thought saved without its details"));
    await box(page).press("ControlOrMeta+Enter");
    await expect(status(page)).toHaveText("Captured, but its details couldn't be loaded.");
    await expect(box(page)).toHaveValue("");
  });
});

test("a keypress that lands just as a capture finishes does not send it again", async ({ page }, testInfo) => {
  // Development builds render the cleared field before any other task can run, so the gap this test probes
  // exists only in the production build.
  test.skip(testInfo.project.name !== "production", "the race exists only in production builds");
  // Right after the response body is read, and before the browser yields, press Cmd/Ctrl + Enter again.
  await page.evaluate(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const res = await realFetch(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/api/capture")) return res;
      const readJson = res.json.bind(res);
      res.json = () => {
        const body = readJson();
        void body.then(async () => {
          for (let i = 0; i < 20; i++) await Promise.resolve();
          const field = document.getElementById("capture");
          field?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, ctrlKey: true, bubbles: true }));
          (window as unknown as { pcfLatePress: boolean }).pcfLatePress = true;
        });
        return body;
      };
      return res;
    };
  });
  const posts: string[] = [];
  page.on("request", (r) => {
    if (isCapturePost(r.url(), r.method())) posts.push(r.url());
  });

  const text = unique("a thought followed by a late keypress");
  const res = await capture(page, text);
  expect(res.status).toBe(200);
  await expect.poll(() => page.evaluate(() => (window as unknown as { pcfLatePress?: boolean }).pcfLatePress)).toBe(true);
  await expect(status(page)).toHaveText("Captured.");
  await page.waitForTimeout(500);
  expect(posts).toHaveLength(1);
  await page.reload();
  await expect(cardFor(page, text)).toHaveCount(1);
});

test("auto-repeated Cmd/Ctrl + Enter keydowns do not capture", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (isCapturePost(r.url(), r.method())) posts.push(r.url());
  });
  const text = unique("a thought under a held-down shortcut");
  await box(page).fill(text);
  await box(page).evaluate((field) => {
    for (let i = 0; i < 3; i++) {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, ctrlKey: true, repeat: true, bubbles: true }));
    }
  });
  await page.waitForTimeout(500);
  expect(posts).toEqual([]);
  await expect(box(page)).toHaveValue(text);
  await expect(status(page)).toHaveText("");
});

test("both Cmd + Enter and Ctrl + Enter capture", async ({ page }) => {
  for (const keys of ["Meta+Enter", "Control+Enter"]) {
    const text = unique(`a thought captured with ${keys}`);
    await box(page).fill(text);
    const response = page.waitForResponse((r) => isCapturePost(r.url(), r.request().method()));
    await box(page).press(keys);
    expect((await response).status()).toBe(200);
    await expect(cardFor(page, text)).toHaveCount(1);
    await expect(box(page)).toHaveValue("");
  }
});

test("requests addressed to another host name get neither thoughts nor captures", async ({ page }) => {
  const text = unique("a private thought");
  await capture(page, text);
  await expect(cardFor(page, text)).toHaveCount(1);

  const foreign = { host: "rebind.attacker.example:3210" };
  const today = await page.request.get("/", { headers: foreign });
  expect(today.status()).toBe(404);
  expect(await today.text()).not.toContain(text);

  const before = await cards(page).count();
  const post = await page.request.post("/api/capture", {
    headers: { ...foreign, "content-type": "application/json" },
    data: JSON.stringify({ content: unique("a capture from a rebinding page") }),
  });
  expect(post.status()).toBe(403);
  await page.reload();
  await expect(cards(page)).toHaveCount(before);
});
