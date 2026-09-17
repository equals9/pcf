import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reasoner, RunStructuredInput } from "../../lib/ai/reasoner";
import { openDatabase, type PcfDatabase } from "../../lib/db/database";
import { listEvents } from "../../lib/db/repositories/events";
import { getObject, listObjects } from "../../lib/db/repositories/objects";
import { fallbackHouseVector } from "../../lib/engine/house-classifier";
import { EXTRACTION, HOUSES, SPEC_CAPTURE_TEXT, count, newTestDb } from "../fixtures/capture-fixtures";
import { MockReasoner } from "../fixtures/mock-reasoner";

// SPEC §26 POST /api/capture, through the real route module. Only the app database and the Claude adapter
// class are replaced: the database with a test database, the adapter with a MockReasoner.

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

vi.mock("../../lib/engine/capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/engine/capture")>();
  return { ...actual, captureThought: vi.fn(actual.captureThought) };
});

const { POST } = await import("../../app/api/capture/route");
const { captureThought } = await import("../../lib/engine/capture");
const pipelineRuns = () => vi.mocked(captureThought).mock.calls.length;

const RELATION = { proposals: [{ targetId: "", type: "related_to", confidence: 0.8, rationale: "Both concern memory." }] };

function mock(responses: ConstructorParameters<typeof MockReasoner>[0] = {}) {
  const reasoner = new MockReasoner(responses);
  app.reasoner = reasoner;
  return reasoner;
}

function request(
  body: unknown,
  init: { contentType?: string | null; raw?: string; signal?: AbortSignal; host?: string | null; origin?: string } = {},
): Request {
  const headers = new Headers();
  if (init.contentType !== null) headers.set("content-type", init.contentType ?? "application/json");
  if (init.host !== null) headers.set("host", init.host ?? "localhost:3000");
  if (init.origin !== undefined) headers.set("origin", init.origin);
  return new Request("http://localhost/api/capture", {
    method: "POST",
    headers,
    body: init.raw ?? JSON.stringify(body),
    signal: init.signal,
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

/** Wraps a reasoner so extraction waits for `gate`, and reports when each extraction starts. */
function gatedExtraction(inner: Reasoner, gate: Promise<void>, onStart: () => void): Reasoner {
  return {
    healthCheck: () => inner.healthCheck(),
    async runStructured<T>(input: RunStructuredInput<T>): Promise<T> {
      if (input.task === "extract") {
        onStart();
        await gate;
      }
      return inner.runStructured(input);
    },
  };
}

let errors: unknown[][];

beforeEach(() => {
  vi.mocked(captureThought).mockClear();
  app.db = newTestDb();
  app.reasoner = null;
  app.reasonersCreated = 0;
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
});

afterEach(() => {
  vi.mocked(console.error).mockRestore();
  app.db?.close();
  app.db = null;
});

const db = () => app.db as PcfDatabase;
const loggedText = () => errors.flat().map(String).join("\n");

describe("POST /api/capture: success", () => {
  it("returns the engine's result, and the route adds no reasoner calls of its own", async () => {
    const reasoner = mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["concepts", "enrichment", "houseVector", "object", "relations"]);
    expect(body.object).toMatchObject({ content: SPEC_CAPTURE_TEXT, title: EXTRACTION.title, type: "idea" });
    expect(body.houseVector["2"]).toBe(0.8);
    expect(body.concepts.map((c: { name: string }) => c.name)).toEqual(["AI memory", "Model weights", "persistence"]);
    expect(body.relations).toEqual([]);
    expect(body.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "none" });
    expect(getObject(db(), body.object.id)).toMatchObject({ content: SPEC_CAPTURE_TEXT });
    expect(count(db(), "objects")).toBe(1);
    expect(reasoner.calls.map((c) => c.task)).toEqual(["extract", "classify-houses"]);
    expect(app.reasonersCreated).toBe(1);
    expect(pipelineRuns()).toBe(1);
  });

  it("returns proposed relations when an earlier thought exists, with one inference call", async () => {
    mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    const first = await (await POST(request({ content: "Earlier thought about AI memory" }))).json();

    const reasoner = mock({
      responses: {
        extract: EXTRACTION,
        "classify-houses": HOUSES,
        "infer-relations": { proposals: [{ ...RELATION.proposals[0], targetId: first.object.id }] },
      },
    });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "ok" });
    expect(body.relations).toEqual([
      expect.objectContaining({ sourceId: body.object.id, targetId: first.object.id, status: "proposed", origin: "ai_inferred" }),
    ]);
    expect(reasoner.calls.map((c) => c.task)).toEqual(["extract", "classify-houses", "infer-relations"]);
  });

  it("keeps the content exactly as sent", async () => {
    mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    const content = "  leading space\n\ttab and trailing  ";
    const body = await (await POST(request({ content }))).json();
    expect(getObject(db(), body.object.id)?.content).toBe(content);
  });
});

describe("POST /api/capture: invalid requests store nothing", () => {
  const cases: Array<[string, Request, number]> = [
    ["blank content", request({ content: "  \n\t " }), 400],
    ["empty content", request({ content: "" }), 400],
    ["missing content", request({}), 400],
    ["non-string content", request({ content: 42 }), 400],
    ["null content", request({ content: null }), 400],
    ["an array body", request([SPEC_CAPTURE_TEXT]), 400],
    ["a null body", request(null), 400],
    ["a string body", request(SPEC_CAPTURE_TEXT), 400],
    ["malformed JSON", request(null, { raw: '{"content": "unterminated' }), 400],
    ["an empty body", request(null, { raw: "" }), 400],
    ["a text/plain body", request({ content: SPEC_CAPTURE_TEXT }, { contentType: "text/plain" }), 415],
    ["a form body", request(null, { contentType: "application/x-www-form-urlencoded", raw: "content=hello" }), 415],
    ["no explicit content type (a string body defaults to text/plain)", request({ content: SPEC_CAPTURE_TEXT }, { contentType: null }), 415],
    ["a lookalike content type", request({ content: SPEC_CAPTURE_TEXT }, { contentType: "application/jsonp" }), 415],
  ];

  it.each(cases)("rejects %s", async (_label, req, status) => {
    const reasoner = mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    const res = await POST(req);
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error: status === 415 ? "unsupported_media_type" : "invalid_request", saved: false });
    expect(count(db(), "objects")).toBe(0);
    expect(count(db(), "events")).toBe(0);
    expect(reasoner.calls).toEqual([]);
    expect(pipelineRuns()).toBeLessThanOrEqual(1);
  });

  it("accepts a JSON content type with parameters", async () => {
    mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }, { contentType: "Application/JSON; charset=utf-8" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/capture: only requests addressed to this machine", () => {
  const refused: Array<[string, Request]> = [
    ["a DNS-rebinding host name", request({ content: SPEC_CAPTURE_TEXT }, { host: "rebind.attacker.example:3000" })],
    ["a LAN address", request({ content: SPEC_CAPTURE_TEXT }, { host: "192.168.1.23:3000" })],
    ["a loopback lookalike", request({ content: SPEC_CAPTURE_TEXT }, { host: "localhost.attacker.example" })],
    ["userinfo before a foreign host", request({ content: SPEC_CAPTURE_TEXT }, { host: "localhost@attacker.example" })],
    ["no host header", request({ content: SPEC_CAPTURE_TEXT }, { host: null })],
    ["a foreign origin", request({ content: SPEC_CAPTURE_TEXT }, { origin: "http://attacker.example" })],
    ["an opaque origin", request({ content: SPEC_CAPTURE_TEXT }, { origin: "null" })],
  ];

  it.each(refused)("refuses %s without storing anything", async (_label, req) => {
    const reasoner = mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "forbidden", saved: false });
    expect(count(db(), "objects")).toBe(0);
    expect(reasoner.calls).toEqual([]);
    expect(pipelineRuns()).toBe(0);
  });

  it.each([
    ["localhost", request({ content: SPEC_CAPTURE_TEXT }, { host: "localhost:3000", origin: "http://localhost:3000" })],
    ["127.0.0.1", request({ content: SPEC_CAPTURE_TEXT }, { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" })],
    ["[::1]", request({ content: SPEC_CAPTURE_TEXT }, { host: "[::1]:3000" })],
  ])("accepts %s", async (_label, req) => {
    mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    expect((await POST(req)).status).toBe(200);
  });
});

describe("POST /api/capture: failures", () => {
  it("says nothing was saved when the raw commit fails, and calls no reasoner", async () => {
    db().exec("CREATE TRIGGER no_events BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'test: events unavailable'); END;");
    const reasoner = mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "capture_not_saved", message: expect.any(String), saved: false });
    expect(count(db(), "objects")).toBe(0);
    expect(reasoner.calls).toEqual([]);
    expect(pipelineRuns()).toBe(1);
    expect(loggedText()).toContain('"outcome":"not_saved"');
    expect(loggedText()).not.toContain(SPEC_CAPTURE_TEXT);
  });

  it("says nothing was saved when the database cannot be opened", async () => {
    app.db?.close();
    app.db = null;
    const reasoner = mock({ responses: { extract: EXTRACTION } });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "capture_not_saved", saved: false });
    expect(reasoner.calls).toEqual([]);
  });

  it("says the thought was saved when the pipeline fails after the raw commit", async () => {
    mock({
      responses: {
        extract: EXTRACTION,
        "classify-houses": () => {
          db().exec("DROP TABLE relations");
          return HOUSES;
        },
      },
    });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(500);
    const [stored] = listObjects(db());
    expect(await res.json()).toEqual({
      error: "capture_saved_incomplete",
      message: expect.any(String),
      saved: true,
      objectId: stored.id,
    });
    expect(stored.content).toBe(SPEC_CAPTURE_TEXT);
    expect(count(db(), "objects")).toBe(1);
    expect(listEvents(db(), { type: "OBJECT_CAPTURED" })).toHaveLength(1);
    expect(pipelineRuns()).toBe(1);
    expect(loggedText()).toContain('"outcome":"saved_incomplete"');
    expect(loggedText()).not.toContain(SPEC_CAPTURE_TEXT);
  });

  it("returns 200 with the raw thought when extraction output is invalid", async () => {
    mock({ responses: { extract: { ...EXTRACTION, title: "" }, "classify-houses": HOUSES } });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrichment).toEqual({ extraction: "failed", houses: "classified", relations: "none" });
    expect(body.object).toMatchObject({ content: SPEC_CAPTURE_TEXT, title: null });
    expect(getObject(db(), body.object.id)).not.toBeNull();
    expect(count(db(), "objects")).toBe(1);
    expect(pipelineRuns()).toBe(1);
  });

  it("returns 200 with the fallback vector when house classification fails", async () => {
    mock({ responses: { extract: EXTRACTION, "classify-houses": { scores: {} } } });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrichment.houses).toBe("fallback");
    expect(body.houseVector).toEqual(JSON.parse(JSON.stringify(fallbackHouseVector())));
  });

  it("returns 200 without relations when relation inference fails", async () => {
    mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } });
    await POST(request({ content: "Earlier thought about AI memory" }));
    mock({ responses: { extract: EXTRACTION, "classify-houses": HOUSES, "infer-relations": { proposals: "nope" } } });
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "failed" });
    expect(body.relations).toEqual([]);
    expect(body.object.title).toBe(EXTRACTION.title);
  });

  it("returns 200 with the raw thought when Claude is unavailable", async () => {
    const reasoner = new MockReasoner({ unavailable: true });
    app.reasoner = reasoner;
    const res = await POST(request({ content: SPEC_CAPTURE_TEXT }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrichment).toEqual({ extraction: "failed", houses: "fallback", relations: "skipped" });
    expect(body.object.content).toBe(SPEC_CAPTURE_TEXT);
    expect(reasoner.calls.map((c) => c.task)).toEqual(["extract"]);
    expect(count(db(), "objects")).toBe(1);
    expect(pipelineRuns()).toBe(1);
  });
});

describe("POST /api/capture: durability and concurrency", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pcf-route-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the raw thought, and finishes enrichment, when the client disconnects mid-capture", async () => {
    const file = join(dir, "pcf.db");
    app.db?.close();
    app.db = newTestDb(file);
    const gate = deferred();
    const started = deferred();
    app.reasoner = gatedExtraction(new MockReasoner({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } }), gate.promise, started.resolve);

    const client = new AbortController();
    const pending = POST(request({ content: SPEC_CAPTURE_TEXT }, { signal: client.signal }));
    await started.promise;

    // The raw thought is committed and visible to another connection before any reasoner call returns.
    const other = openDatabase(file);
    try {
      expect(listObjects(other).map((o) => o.content)).toEqual([SPEC_CAPTURE_TEXT]);
    } finally {
      other.close();
    }

    client.abort();
    gate.resolve();
    const res = await pending;
    expect(res.status).toBe(200);

    const reopened = openDatabase(file);
    try {
      const [stored] = listObjects(reopened);
      expect(stored).toMatchObject({ content: SPEC_CAPTURE_TEXT, title: EXTRACTION.title });
      expect(listEvents(reopened, { objectId: stored.id }).map((e) => e.type)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED"]);
    } finally {
      reopened.close();
    }
  });

  it("handles simultaneous submissions as separate captures, each stored before any enrichment", async () => {
    const gate = deferred();
    let extractionsStarted = 0;
    const bothStarted = deferred();
    app.reasoner = gatedExtraction(new MockReasoner({ responses: { extract: EXTRACTION, "classify-houses": HOUSES } }), gate.promise, () => {
      if (++extractionsStarted === 2) bothStarted.resolve();
    });

    const a = POST(request({ content: "first simultaneous thought" }));
    const b = POST(request({ content: "second simultaneous thought" }));
    await bothStarted.promise;
    expect(listObjects(db()).map((o) => o.content).sort()).toEqual(["first simultaneous thought", "second simultaneous thought"]);
    expect(listEvents(db()).map((e) => e.type)).toEqual(["OBJECT_CAPTURED", "OBJECT_CAPTURED"]);

    gate.resolve();
    const [ra, rb] = await Promise.all([a, b]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    const [ba, bb] = [await ra.json(), await rb.json()];
    expect(ba.object.id).not.toBe(bb.object.id);
    expect(count(db(), "objects")).toBe(2);
    for (const id of [ba.object.id, bb.object.id]) {
      expect(listEvents(db(), { type: "OBJECT_EXTRACTED", objectId: id })).toHaveLength(1);
    }
  });
});

describe("the capture route is only an adapter", () => {
  const source = readFileSync(join(__dirname, "../../app/api/capture/route.ts"), "utf8");

  it("imports only the adapter class, the app database, the capture engine entry point and the loopback check", () => {
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports).toEqual([
      "../../../lib/ai/claude-subscription",
      "../../../lib/db/database",
      "../../../lib/engine/capture",
      "../../../lib/utils/local-request",
    ]);
    expect(source).toMatch(/import \{ ClaudeSubscriptionReasoner \} from/);
    expect(source).toMatch(/import \{ CaptureAfterSaveError, CaptureValidationError, captureThought \} from/);
  });

  it("calls the pipeline exactly once and has no prompts or reasoner calls of its own", () => {
    expect(source.match(/captureThought\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/runStructured|prompts|system:/);
  });
});
