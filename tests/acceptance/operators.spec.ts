import { expect, test, type Locator, type Page } from "@playwright/test";

// SPEC §23, §25C, §25D: the four cognitive operators on a thought card, their results inline beneath it, and
// feedback on each result. Every call goes through the real route, engine and adapter; only the `claude`
// executable is a local fake.

let seq = 0;
const unique = (label: string) => `${label} #${Date.now()}-${++seq}`;

const box = (page: Page) => page.getByRole("textbox", { name: "What are you thinking?" });
const cardFor = (page: Page, text: string) =>
  page
    .getByRole("article")
    .filter({ has: page.getByRole("group", { name: "Cognitive operators" }) })
    .filter({ hasText: text });
const operatorState = (card: Locator) => card.locator(".operators__state");
const isOperatorPost = (url: string, method: string) => /\/api\/object\/[^/]+\/operator$/.test(new URL(url).pathname) && method === "POST";

/** Capture a thought and return its card once the stream has rendered it. */
async function captureCard(page: Page, text: string): Promise<{ card: Locator; body: { object: { id: string } } }> {
  await box(page).fill(text);
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/capture" && r.request().method() === "POST");
  await box(page).press("ControlOrMeta+Enter");
  const body = await (await response).json();
  const card = cardFor(page, text);
  await expect(card).toHaveCount(1);
  return { card, body };
}

async function invoke(page: Page, card: Locator, name: string) {
  const response = page.waitForResponse((r) => isOperatorPost(r.url(), r.request().method()));
  await card.getByRole("button", { name, exact: false }).click();
  return await response;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("A4: a thought card exposes exactly four AI operations", async ({ page }) => {
  const { card } = await captureCard(page, unique("a thought to operate on"));
  const operators = card.getByRole("group", { name: "Cognitive operators" }).getByRole("button");
  await expect(operators).toHaveCount(4);
  await expect(operators).toHaveText([/Connect/, /Expand/, /Challenge/, /Act/]);
  // No other AI action on the card.
  await expect(card.getByRole("button")).toHaveCount(4);
});

test("each operator returns its own kind of result, one run at a time", async ({ page }) => {
  const { card } = await captureCard(page, unique("a thought with four operators"));

  const connect = await invoke(page, card, "Connect");
  expect(connect.status()).toBe(200);
  expect((await connect.json()).operator).toBe("mercury_connect");
  await expect(card.getByRole("article", { name: /Connect result/ })).toContainText("Fake connection");
  await expect(card.getByRole("article", { name: /Connect result/ })).toContainText("nothing was added to your graph");

  const expand = await invoke(page, card, "Expand");
  expect((await expand.json()).operator).toBe("jupiter_expand");
  await expect(card.getByRole("article", { name: /Expand result/ })).toContainText("Fake adjacent possibility");
  await expect(card.getByRole("article", { name: /Expand result/ })).toContainText("Possibility");

  const challenge = await invoke(page, card, "Challenge");
  expect((await challenge.json()).operator).toBe("saturn_challenge");
  await expect(card.getByRole("article", { name: /Challenge result/ })).toContainText("Fake strongest objection");

  const act = await invoke(page, card, "Act");
  expect((await act.json()).operator).toBe("mars_act");
  await expect(card.getByRole("article", { name: /Act result/ })).toContainText("Fake smallest action");
  await expect(card.getByRole("article", { name: /Act result/ })).toContainText("Nothing runs on its own");
});

test("an operator shows its own processing state and blocks a second run", async ({ page }) => {
  const { card } = await captureCard(page, unique("pcf-e2e-slow a thought whose operators are slow"));
  const posts: string[] = [];
  page.on("request", (r) => {
    if (isOperatorPost(r.url(), r.method())) posts.push(r.url());
  });

  const response = page.waitForResponse((r) => isOperatorPost(r.url(), r.request().method()));
  await card.getByRole("button", { name: /Challenge/ }).click();
  await expect(operatorState(card)).toHaveText("Challenging…");
  await expect(card.getByRole("button", { name: /Challenge/ })).toBeDisabled();
  await expect(card.getByRole("button", { name: /Act/ })).toBeDisabled();
  await card.getByRole("button", { name: /Act/ }).click({ force: true });
  await response;

  await expect(card.getByRole("article", { name: /Challenge result/ })).toBeVisible();
  await expect(card.getByRole("button", { name: /Act/ })).toBeEnabled();
  expect(posts).toHaveLength(1);
});

test("two operator clicks in the same task run only one operator", async ({ page }) => {
  // Clicks dispatched in one JS task land before React commits the disabled state, so only the in-flight
  // guard stops the second one. This is the window a fast double-click actually hits in a production build.
  const { card } = await captureCard(page, unique("pcf-e2e-slow a thought clicked twice at once"));
  const posts: string[] = [];
  page.on("request", (r) => {
    if (isOperatorPost(r.url(), r.method())) posts.push(r.url());
  });

  const response = page.waitForResponse((r) => isOperatorPost(r.url(), r.request().method()));
  await card.evaluate((node) => {
    const buttons = node.querySelectorAll<HTMLButtonElement>(".operators__button");
    buttons[0].click();
    buttons[1].click();
    buttons[0].click();
  });
  expect((await response).status()).toBe(200);
  await expect(card.getByRole("article", { name: /result/ })).toHaveCount(1);
  expect(posts).toHaveLength(1);
});

test("feedback on a result is recorded and does not change the result", async ({ page }) => {
  const { card } = await captureCard(page, unique("a thought worth judging"));
  await invoke(page, card, "Act");
  const result = card.getByRole("article", { name: /Act result/ });
  const textBefore = await result.textContent();

  const feedback = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/feedback" && r.request().method() === "POST");
  await result.getByRole("button", { name: "Useful", exact: true }).click();
  const response = await feedback;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ targetType: "operator_run", action: "useful" });

  await expect(result.getByText("Thanks — recorded.")).toBeVisible();
  await expect(result).toContainText("Fake smallest action");
  expect(textBefore).toContain("Fake smallest action");
});

test("a second result on the same card can be rated too", async ({ page }) => {
  const { card } = await captureCard(page, unique("a thought rated twice"));
  await invoke(page, card, "Act");
  const act = card.getByRole("article", { name: /Act result/ });
  const feedback = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/feedback" && r.request().method() === "POST");
  await act.getByRole("button", { name: "Useful", exact: true }).click();
  const firstRunId = (await (await feedback).json()).targetId;
  await expect(act.getByText("Thanks — recorded.")).toBeVisible();

  await invoke(page, card, "Challenge");
  const challenge = card.getByRole("article", { name: /Challenge result/ });
  // The new result must not inherit the previous result's feedback state.
  await expect(challenge.getByText("Thanks — recorded.")).toHaveCount(0);
  const second = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/feedback" && r.request().method() === "POST");
  await challenge.getByRole("button", { name: "Useful", exact: true }).click();
  const secondBody = await (await second).json();
  expect(secondBody.targetId).not.toBe(firstRunId);
  await expect(challenge.getByText("Thanks — recorded.")).toBeVisible();
});

test("a failing operator says so without losing the thought", async ({ page }) => {
  const { card } = await captureCard(page, unique("pcf-e2e-operator-invalid a thought whose operators fail"));
  const response = await invoke(page, card, "Challenge");
  expect(response.status()).toBe(503);
  await expect(operatorState(card)).toHaveText("Couldn't complete this operation. Your thought is safe.");
  await expect(card.getByRole("article", { name: /result/ })).toHaveCount(0);
  await expect(card).toContainText("a thought whose operators fail");
});

test("invoking an operator keeps the capture draft and the constellation focus", async ({ page }) => {
  const { card } = await captureCard(page, unique("a thought to keep focus on"));
  await card.locator(".thought__link").click();
  await expect(page).toHaveURL(/\?focus=/);
  const focusUrl = page.url();
  const anchor = await page.locator(".constellation__anchor-name").textContent();
  const nodes = await page.locator(".constellation__node").count();

  const draft = "a draft that must survive a cognitive operation";
  await box(page).fill(draft);
  await invoke(page, card, "Expand");

  await expect(card.getByRole("article", { name: /Expand result/ })).toBeVisible();
  await expect(box(page)).toHaveValue(draft);
  expect(page.url()).toBe(focusUrl);
  await expect(page.locator(".constellation__anchor-name")).toHaveText(anchor!);
  expect(await page.locator(".constellation__node").count()).toBe(nodes);
});

test("operators are reachable and usable from the keyboard", async ({ page }) => {
  const { card } = await captureCard(page, unique("a thought operated by keyboard"));
  const challenge = card.getByRole("button", { name: /Challenge/ });
  await challenge.focus();
  await expect(challenge).toBeFocused();
  const response = page.waitForResponse((r) => isOperatorPost(r.url(), r.request().method()));
  await page.keyboard.press("Enter");
  expect((await response).status()).toBe(200);
  await expect(card.getByRole("article", { name: /Challenge result/ })).toBeVisible();
  // SPEC §37: the buttons were disabled during the run; focus comes back to the one that was pressed rather
  // than falling to the page. The result arrives inside a polite live region, so it is announced.
  await expect(challenge).toBeFocused();
  await expect(card.locator('[aria-live="polite"] .operator')).toHaveCount(1);

  const useful = card.getByRole("button", { name: "Useful", exact: true });
  await useful.focus();
  await page.keyboard.press("Enter");
  const recorded = card.getByText("Thanks — recorded.");
  await expect(recorded).toBeVisible();
  // The buttons that had focus are gone; the confirmation holds it.
  await expect(recorded).toBeFocused();
});

test("operator routes refuse requests addressed to another host", async ({ page }) => {
  const { body: captured } = await captureCard(page, unique("a private thought for the operators"));
  const foreign = { host: "rebind.attacker.example:3211", "content-type": "application/json" };

  const operator = await page.request.post(`/api/object/${captured.object.id}/operator`, {
    headers: foreign,
    data: JSON.stringify({ operator: "mars_act" }),
  });
  expect(operator.status()).toBe(403);

  const feedback = await page.request.post("/api/feedback", {
    headers: foreign,
    data: JSON.stringify({ targetType: "object", targetId: captured.object.id, action: "useful" }),
  });
  expect(feedback.status()).toBe(403);
});
