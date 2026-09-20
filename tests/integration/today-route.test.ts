import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PcfDatabase } from "../../lib/db/database";
import { insertClaim } from "../../lib/db/repositories/claims";
import { attachConcept, upsertConcept } from "../../lib/db/repositories/concepts";
import { listEvents } from "../../lib/db/repositories/events";
import { getObject, insertObject, setHouseScores } from "../../lib/db/repositories/objects";
import { houseVector } from "../../lib/domain/houses";
import { localDateString, localDayBounds } from "../../lib/utils/time";
import { count, newTestDb } from "../fixtures/capture-fixtures";
import { MockReasoner } from "../fixtures/mock-reasoner";

// SPEC §26 GET /api/today, through the real route module. It is the one place §24 detection runs, and it
// classifies at most one object per request.

const app = vi.hoisted(() => ({ db: null as PcfDatabase | null, reasoner: null as unknown, reasonersCreated: 0 }));

vi.mock("../../lib/db/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/database")>();
  return {
    ...actual,
    getAppDatabase: () => {
      if (!app.db) throw new Error("test: database unavailable");
      return app.db;
    },
  };
});

vi.mock("../../lib/ai/claude-subscription", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ai/claude-subscription")>();
  class TestReasoner {
    constructor() {
      app.reasonersCreated++;
      return app.reasoner as TestReasoner;
    }
  }
  return { ...actual, ClaudeSubscriptionReasoner: TestReasoner };
});

const { GET } = await import("../../app/api/today/route");

/** Minutes into the current local day, so a test object is always "today" whatever the clock says. */
const todayAt = (minutes: number) => new Date(Date.parse(localDayBounds(new Date()).start) + minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function addObject(db: PcfDatabase, id: string, at: string, concepts: string[]) {
  insertObject(db, {
    id,
    type: "claim",
    content: `content of ${id}`,
    title: `title of ${id}`,
    createdAt: at,
    updatedAt: at,
    lastActivatedAt: null,
    importance: 0.6,
    activation: 0.5,
    status: "active",
    provenance: "user",
  });
  for (const name of concepts) attachConcept(db, id, upsertConcept(db, name, at).id);
  const v = houseVector(0.05);
  v[2] = 0.9;
  setHouseScores(db, id, v);
}

function addClaim(db: PcfDatabase, id: string, objectId: string, text: string) {
  insertClaim(
    db,
    {
      id,
      objectId,
      normalizedClaim: text,
      subject: "personal AI memory",
      predicate: "belongs",
      objectText: "somewhere",
      polarity: "positive",
      scope: null,
      confidence: 0.7,
      validFrom: null,
      validTo: null,
    },
    todayAt(3),
  );
}

const contradicting = () =>
  new MockReasoner({
    responses: {
      "classify-contradictions": ({ prompt }) => {
        const sent = JSON.parse(prompt.slice(prompt.indexOf("{"))) as { pairs: Array<{ a: { id: string }; b: { id: string } }> };
        return {
          results: sent.pairs.map((pair) => ({
            claimAId: pair.a.id,
            claimBId: pair.b.id,
            classification: "true_contradiction",
            confidence: 0.88,
            explanation: "They cannot both hold.",
            unresolvedQuestion: "Which one do you actually believe?",
          })),
        };
      },
    },
  });

function request(init: { host?: string | null; origin?: string; site?: string; dest?: string } = {}): Request {
  const headers = new Headers();
  if (init.host !== null) headers.set("host", init.host ?? "localhost:3000");
  if (init.origin !== undefined) headers.set("origin", init.origin);
  if (init.site !== undefined) headers.set("sec-fetch-site", init.site);
  if (init.dest !== undefined) headers.set("sec-fetch-dest", init.dest);
  return new Request("http://localhost/api/today", { headers });
}

beforeEach(() => {
  app.db = newTestDb();
  app.reasoner = contradicting();
  app.reasonersCreated = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.mocked(console.error).mockRestore();
  app.db?.close();
  app.db = null;
});

const db = () => app.db as PcfDatabase;

describe("GET /api/today", () => {
  it("returns the frozen §26 shape", async () => {
    addObject(db(), "today-1", todayAt(1), ["memory"]);
    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["checked", "date", "objects", "resurfaced", "tension"]);
    // The local calendar date: a UTC slice reports yesterday for every timezone east of UTC.
    expect(body.date).toBe(localDateString(new Date()));
    expect(body.objects.map((o: { id: string }) => o.id)).toEqual(["today-1"]);
    expect(body.resurfaced).toBeNull();
    expect(body.tension).toBeNull();
  });

  it("returns at most one resurfaced thought, and records it once", async () => {
    addObject(db(), "today-1", todayAt(1), ["memory"]);
    addObject(db(), "old-1", daysAgo(90), ["memory"]);
    addObject(db(), "old-2", daysAgo(120), ["memory"]);

    const body = await (await GET(request())).json();
    expect(body.resurfaced).not.toBeNull();
    expect(body.resurfaced.why).toBeTruthy();
    expect(typeof body.resurfaced.ageDays).toBe("number");
    expect(listEvents(db(), { type: "OBJECT_RESURFACED" })).toHaveLength(1);

    await GET(request());
    expect(listEvents(db(), { type: "OBJECT_RESURFACED" })).toHaveLength(1);
  });

  it("classifies one unchecked object per request and returns the tension", async () => {
    addObject(db(), "inside", todayAt(1), ["memory"]);
    addObject(db(), "outside", todayAt(2), ["memory"]);
    addClaim(db(), "claim-inside", "inside", "Personal AI memory should live inside model weights.");
    addClaim(db(), "claim-outside", "outside", "Personal AI memory should remain outside model weights.");

    const first = await (await GET(request())).json();
    expect(first.checked).toBe("outside");
    expect(first.tension).toMatchObject({ classification: "true_contradiction", confidence: 0.88 });
    expect((app.reasoner as MockReasoner).calls).toHaveLength(1);

    // The pair is judged once. Later requests have no work left and spend nothing.
    const second = await (await GET(request())).json();
    expect(second.checked).toBeNull();
    expect(second.tension).toMatchObject({ classification: "true_contradiction" });
    await GET(request());
    expect((app.reasoner as MockReasoner).calls).toHaveLength(1);
    expect(listEvents(db(), { type: "CONTRADICTION_DETECTED" })).toHaveLength(1);
  });

  it("still returns Today when classification fails, and writes nothing", async () => {
    addObject(db(), "inside", todayAt(1), ["memory"]);
    addObject(db(), "outside", todayAt(2), ["memory"]);
    addClaim(db(), "claim-inside", "inside", "Memory belongs inside.");
    addClaim(db(), "claim-outside", "outside", "Memory belongs outside.");
    app.reasoner = new MockReasoner({ unavailable: true });

    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tension).toBeNull();
    expect(body.objects).toHaveLength(2);
    expect(listEvents(db(), { type: "CONTRADICTION_DETECTED" })).toEqual([]);

    // Nothing was recorded, so the object is still pending: the next request tries once more, and only
    // once. No request ever makes more than one logical call, and no request retries on its own.
    const reasoner = app.reasoner as MockReasoner;
    expect(reasoner.calls).toHaveLength(1);
    await GET(request());
    expect(reasoner.calls).toHaveLength(2);
  });

  it("is the only path to the reasoner: the Today page render and the cards never reach it", () => {
    const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf8");
    const page = read("components/today/TodayView.tsx");
    // The page renders from local state through the engines' read-only entry points.
    expect(page).toMatch(/currentTension\(db\)/);
    expect(page).toMatch(/resurfaceForToday\(db\)/);
    expect(page).not.toMatch(/claude-subscription|ClaudeSubscriptionReasoner|detectContradictions|fetch\(|\/api\/today/);
    for (const rel of ["components/today/ResurfacedCard.tsx", "components/today/TensionCard.tsx", "lib/engine/resurfacing.ts"]) {
      expect(read(rel)).not.toMatch(/claude-subscription|ClaudeSubscriptionReasoner|runStructured|\/api\/today/);
    }
    // The one client caller asks only after a confirmed save.
    const capture = read("components/today/CaptureBox.tsx");
    expect(capture.match(/fetch\("\/api\/today"/g)).toHaveLength(1);
    expect(capture).toMatch(/if \(outcome\.saved\) \{\s*router\.refresh\(\);\s*void checkForTension\(/);
  });

  it("never calls the reasoner when no object has claims", async () => {
    addObject(db(), "today-1", todayAt(1), ["memory"]);
    addObject(db(), "today-2", todayAt(2), ["memory"]);
    await GET(request());
    expect((app.reasoner as MockReasoner).calls).toEqual([]);
    expect(app.reasonersCreated).toBe(0);
  });

  it.each([
    ["a rebinding host", { host: "rebind.attacker.example:3000" }],
    ["no host", { host: null }],
    ["a foreign origin", { origin: "http://attacker.example" }],
    // A cross-site <img>/<script>/prefetch carries no Origin, so only fetch metadata catches it.
    ["a cross-site markup load", { site: "cross-site", dest: "image" }],
    ["a same-site markup load from another port", { site: "same-site", dest: "script" }],
    ["an iframe embed", { site: "none", dest: "iframe" }],
  ])("refuses %s before any model call or write", async (_label, init) => {
    addObject(db(), "inside", todayAt(1), ["memory"]);
    addObject(db(), "outside", todayAt(2), ["memory"]);
    addClaim(db(), "claim-inside", "inside", "Memory belongs inside.");
    addClaim(db(), "claim-outside", "outside", "Memory belongs outside.");

    const res = await GET(request(init));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "forbidden" });
    expect((app.reasoner as MockReasoner).calls).toEqual([]);
    expect(count(db(), "events")).toBe(0);
  });

  it("reports the local calendar date in every timezone", async () => {
    addObject(db(), "today-1", todayAt(1), ["memory"]);
    const saved = process.env.TZ;
    const isoDates = new Set<string>();
    try {
      // At any instant one of these two is a different calendar day from UTC, so a UTC slice cannot pass.
      for (const zone of ["Pacific/Kiritimati", "Pacific/Midway"]) {
        process.env.TZ = zone;
        const now = new Date();
        isoDates.add(now.toISOString().slice(0, 10) === localDateString(now) ? "same" : "different");
        expect((await (await GET(request())).json()).date).toBe(localDateString(now));
      }
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
    expect(isoDates).toContain("different");
  });

  it("serves this app's own fetch and a direct visit", async () => {
    addObject(db(), "today-1", todayAt(1), ["memory"]);
    for (const init of [{ site: "same-origin", dest: "empty" }, { site: "none", dest: "document" }]) {
      expect((await GET(request(init))).status).toBe(200);
    }
  });

  it("reports a database failure without leaking content", async () => {
    addObject(db(), "today-1", todayAt(1), ["memory"]);
    db().exec("DROP TABLE house_scores");
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "today_failed" });
  });

  it("changes no thought while building Today", async () => {
    addObject(db(), "today-1", todayAt(1), ["memory"]);
    addObject(db(), "old-1", daysAgo(90), ["memory"]);
    const before = [getObject(db(), "today-1"), getObject(db(), "old-1")];
    await GET(request());
    expect([getObject(db(), "today-1"), getObject(db(), "old-1")]).toEqual(before);
    expect(count(db(), "claims")).toBe(0);
    expect(count(db(), "relations")).toBe(0);
    expect(listEvents(db()).map((e) => e.type)).toEqual(["OBJECT_RESURFACED"]);
  });

  it("is an adapter: it imports only the engines, the app database and the loopback check", () => {
    const source = readFileSync(join(__dirname, "../../app/api/today/route.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports).toEqual([
      "../../../lib/ai/claude-subscription",
      "../../../lib/db/database",
      "../../../lib/db/repositories/objects",
      "../../../lib/engine/contradiction",
      "../../../lib/engine/resurfacing",
      "../../../lib/utils/local-request",
      "../../../lib/utils/time",
    ]);
    expect(code.match(/detectContradictions\(/g)).toHaveLength(1);
    expect(code).not.toMatch(/runStructured|system:|insert|update |while \(|for \(/i);
  });
});
