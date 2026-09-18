import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PcfDatabase } from "../../lib/db/database";
import { attachConcept, upsertConcept } from "../../lib/db/repositories/concepts";
import { listEvents } from "../../lib/db/repositories/events";
import { listFeedbackForTarget } from "../../lib/db/repositories/feedback";
import { getObject, insertObject, setHouseScores } from "../../lib/db/repositories/objects";
import { listOperatorRunsForObject } from "../../lib/db/repositories/operators";
import { houseVector } from "../../lib/domain/houses";
import { count, newTestDb } from "../fixtures/capture-fixtures";
import { MockReasoner } from "../fixtures/mock-reasoner";
import { operatorMock } from "../fixtures/operator-fixtures";

// SPEC §26 POST /api/object/:id/operator and POST /api/feedback, through the real route modules.

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

const { POST: OPERATOR } = await import("../../app/api/object/[id]/operator/route");
const { POST: FEEDBACK } = await import("../../app/api/feedback/route");

const AT = "2026-09-17T12:00:00.000Z";

function add(db: PcfDatabase, id: string, concepts: string[], withHouses = true) {
  insertObject(db, {
    id,
    type: "thought",
    content: `content of ${id}`,
    title: `title of ${id}`,
    createdAt: AT,
    updatedAt: AT,
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
  });
  for (const name of concepts) attachConcept(db, id, upsertConcept(db, name, AT).id);
  if (withHouses) {
    const v = houseVector(0.05);
    v[2] = 0.9;
    setHouseScores(db, id, v);
  }
}

function headers(init: { host?: string | null; origin?: string; contentType?: string | null } = {}): Headers {
  const h = new Headers();
  if (init.contentType !== null) h.set("content-type", init.contentType ?? "application/json");
  if (init.host !== null) h.set("host", init.host ?? "localhost:3000");
  if (init.origin !== undefined) h.set("origin", init.origin);
  return h;
}

function operatorCall(id: string, body: unknown, init: Parameters<typeof headers>[0] = {}) {
  const request = new Request(`http://localhost/api/object/${id}/operator`, { method: "POST", headers: headers(init), body: JSON.stringify(body) });
  return OPERATOR(request, { params: Promise.resolve({ id }) } as never);
}

function feedbackCall(body: unknown, init: Parameters<typeof headers>[0] = {}) {
  return FEEDBACK(new Request("http://localhost/api/feedback", { method: "POST", headers: headers(init), body: JSON.stringify(body) }));
}

let errors: unknown[][];

beforeEach(() => {
  app.db = newTestDb();
  app.reasoner = null;
  app.reasonersCreated = 0;
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
  add(app.db, "anchor", ["alpha"]);
  add(app.db, "other", ["alpha"]);
  app.reasoner = operatorMock(app.db, "anchor");
});

afterEach(() => {
  vi.mocked(console.error).mockRestore();
  app.db?.close();
  app.db = null;
});

const db = () => app.db as PcfDatabase;

describe("POST /api/object/:id/operator", () => {
  it("returns the run id, operator and result, and persists exactly one run", async () => {
    const res = await operatorCall("anchor", { operator: "saturn_challenge" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["objects", "operator", "result", "runId"]);
    expect(body.operator).toBe("saturn_challenge");
    expect(body.result.strongestObjection).toBeTruthy();
    expect(body.objects.map((o: { id: string }) => o.id)).toEqual(["anchor", "other"]);

    const runs = listOperatorRunsForObject(db(), "anchor");
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe(body.runId);
    expect(listEvents(db(), { type: "OPERATOR_INVOKED" })).toHaveLength(1);
    expect(app.reasonersCreated).toBe(1);
    expect((app.reasoner as MockReasoner).calls).toHaveLength(1);
  });

  it.each(["mercury_connect", "jupiter_expand", "saturn_challenge", "mars_act"])("accepts %s", async (operator) => {
    expect((await operatorCall("anchor", { operator })).status).toBe(200);
  });

  it.each([
    ["an unknown operator", { operator: "venus_soothe" }],
    ["a missing operator", {}],
    ["a non-string operator", { operator: 3 }],
    ["a null body", null],
  ])("rejects %s without calling the reasoner", async (_label, body) => {
    const res = await operatorCall("anchor", body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_request" });
    expect(count(db(), "operator_runs")).toBe(0);
    expect((app.reasoner as MockReasoner).calls).toEqual([]);
  });

  it("refuses a non-JSON content type", async () => {
    const res = await operatorCall("anchor", { operator: "mars_act" }, { contentType: "text/plain" });
    expect(res.status).toBe(415);
    expect(count(db(), "operator_runs")).toBe(0);
  });

  it.each([
    ["a rebinding host", { host: "rebind.attacker.example:3000" }],
    ["no host", { host: null }],
    ["a foreign origin", { origin: "http://attacker.example" }],
  ])("refuses %s", async (_label, init) => {
    const res = await operatorCall("anchor", { operator: "mars_act" }, init);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "forbidden" });
    expect(count(db(), "operator_runs")).toBe(0);
    expect((app.reasoner as MockReasoner).calls).toEqual([]);
  });

  it("answers 404 for an unknown object", async () => {
    const res = await operatorCall("missing", { operator: "mars_act" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("answers 409 for an object with no house classification", async () => {
    add(db(), "unclassified", [], false);
    const res = await operatorCall("unclassified", { operator: "mars_act" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "not_classified" });
    expect(count(db(), "operator_runs")).toBe(0);
    expect((app.reasoner as MockReasoner).calls).toEqual([]);
  });

  it("answers 503 without recording a run when the reasoner fails", async () => {
    app.reasoner = new MockReasoner({ unavailable: true });
    const res = await operatorCall("anchor", { operator: "mars_act" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "operator_failed", message: "Couldn't complete this operation. Your thought is safe." });
    expect(count(db(), "operator_runs")).toBe(0);
    expect(listEvents(db(), { type: "OPERATOR_INVOKED" })).toEqual([]);
  });

  it("keeps each invocation as its own run", async () => {
    await operatorCall("anchor", { operator: "mars_act" });
    await operatorCall("anchor", { operator: "mars_act" });
    const runs = listOperatorRunsForObject(db(), "anchor");
    expect(runs).toHaveLength(2);
    expect(new Set(runs.map((r) => r.id)).size).toBe(2);
  });

  it("leaves the thought and its relations untouched", async () => {
    const before = getObject(db(), "anchor");
    await operatorCall("anchor", { operator: "mercury_connect" });
    expect(getObject(db(), "anchor")).toEqual(before);
    expect(count(db(), "relations")).toBe(0);
  });

  it("is an adapter: no prompts, no retry, no persistence of its own", () => {
    const source = readFileSync(join(__dirname, "../../app/api/object/[id]/operator/route.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports).toEqual([
      "../../../../../lib/ai/claude-subscription",
      "../../../../../lib/db/database",
      "../../../../../lib/domain/operators",
      "../../../../../lib/domain/types",
      "../../../../../lib/engine/operator-runner",
      "../../../../../lib/utils/local-request",
    ]);
    expect(code.match(/runOperator\(/g)).toHaveLength(1);
    expect(code).not.toMatch(/runStructured|system:|insert|retry|for \(|while \(/i);
  });
});

describe("POST /api/feedback", () => {
  async function runOnce(): Promise<string> {
    const body = await (await operatorCall("anchor", { operator: "mars_act" })).json();
    return body.runId as string;
  }

  it("records feedback on an operator result", async () => {
    const runId = await runOnce();
    const res = await feedbackCall({ targetType: "operator_run", targetId: runId, action: "useful" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ targetType: "operator_run", targetId: runId, action: "useful" });
    expect(listFeedbackForTarget(db(), "operator_run", runId).map((f) => f.action)).toEqual(["useful"]);
    expect(listEvents(db(), { type: "FEEDBACK_RECORDED" })).toHaveLength(1);
  });

  it("does not change the operator result it is about", async () => {
    const runId = await runOnce();
    const before = listOperatorRunsForObject(db(), "anchor")[0];
    await feedbackCall({ targetType: "operator_run", targetId: runId, action: "not_useful" });
    expect(listOperatorRunsForObject(db(), "anchor")[0]).toEqual(before);
  });

  it.each([
    ["an unknown target type", { targetType: "planet", targetId: "x", action: "useful" }],
    ["an unknown action", { targetType: "operator_run", targetId: "x", action: "loved" }],
    ["a missing target id", { targetType: "operator_run", action: "useful" }],
    ["an empty body", {}],
  ])("rejects %s", async (_label, body) => {
    const res = await feedbackCall(body);
    expect(res.status).toBe(400);
    expect(count(db(), "feedback")).toBe(0);
  });

  it("answers 404 for a target that does not exist", async () => {
    const res = await feedbackCall({ targetType: "operator_run", targetId: "missing", action: "useful" });
    expect(res.status).toBe(404);
    expect(count(db(), "feedback")).toBe(0);
  });

  it.each([
    ["a rebinding host", { host: "rebind.attacker.example:3000" }],
    ["a foreign origin", { origin: "http://attacker.example" }],
  ])("refuses %s", async (_label, init) => {
    const runId = await runOnce();
    const res = await feedbackCall({ targetType: "operator_run", targetId: runId, action: "useful" }, init);
    expect(res.status).toBe(403);
    expect(count(db(), "feedback")).toBe(0);
  });

  it("refuses a non-JSON content type", async () => {
    const res = await feedbackCall({ targetType: "object", targetId: "anchor", action: "opened" }, { contentType: "text/plain" });
    expect(res.status).toBe(415);
    expect(count(db(), "feedback")).toBe(0);
  });
});
