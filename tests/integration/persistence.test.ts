import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type PcfDatabase } from "../../lib/db/database";
import { runMigrations } from "../../lib/db/migrations";
import { insertClaim, listClaimsForObject } from "../../lib/db/repositories/claims";
import { attachConcept, listConceptsForObject, upsertConcept } from "../../lib/db/repositories/concepts";
import { appendEvent, listEvents } from "../../lib/db/repositories/events";
import { insertFeedback, listFeedbackForTarget } from "../../lib/db/repositories/feedback";
import { getHouseScores, getObject, insertObject, listObjects, setHouseScores, updateObject } from "../../lib/db/repositories/objects";
import { getOperatorRun, insertOperatorRun, listOperatorRunsForObject } from "../../lib/db/repositories/operators";
import { getRelation, insertRelation, listRelationsForObject, setRelationStatus } from "../../lib/db/repositories/relations";
import { houseVector } from "../../lib/domain/houses";
import type { CognitiveObject } from "../../lib/domain/types";

const T = "2026-09-16T12:00:00.000Z";

const REQUIRED_TABLES = ["objects", "house_scores", "concepts", "object_concepts", "relations", "claims", "events", "operator_runs", "feedback"];

function obj(id: string, overrides: Partial<CognitiveObject> = {}): CognitiveObject {
  return {
    id,
    type: "thought",
    content: `content ${id}`,
    title: null,
    createdAt: T,
    updatedAt: T,
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
    ...overrides,
  };
}

function tableNames(db: PcfDatabase): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
}

describe("001_initial migration", () => {
  it("creates every required Phase 1 table and is idempotent", () => {
    const db = openDatabase(":memory:");
    const first = runMigrations(db);
    expect(first.applied).toEqual(["001_initial.sql"]);
    const names = tableNames(db);
    for (const t of REQUIRED_TABLES) expect(names).toContain(t);

    const second = runMigrations(db);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["001_initial.sql"]);
    expect(tableNames(db)).toEqual(names);
    db.close();
  });
});

describe("repositories", () => {
  let db: PcfDatabase;
  beforeEach(() => {
    db = openDatabase(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  it("round-trips objects and metadata updates without touching content", () => {
    insertObject(db, obj("a", { title: "A" }));
    expect(getObject(db, "a")).toEqual(obj("a", { title: "A" }));

    const updated = updateObject(db, "a", { type: "idea", importance: 0.9, lastActivatedAt: T }, "2026-09-16T13:00:00.000Z");
    expect(updated.type).toBe("idea");
    expect(updated.content).toBe("content a");
    expect(getObject(db, "a")?.updatedAt).toBe("2026-09-16T13:00:00.000Z");

    expect(() => insertObject(db, obj("bad", { type: "note" as CognitiveObject["type"] }))).toThrow();
    expect(() => updateObject(db, "a", { importance: 2 }, T)).toThrow();
  });

  it("lists objects newest first", () => {
    insertObject(db, obj("old", { createdAt: "2026-09-01T00:00:00.000Z" }));
    insertObject(db, obj("new", { createdAt: "2026-09-15T00:00:00.000Z" }));
    expect(listObjects(db).map((o) => o.id)).toEqual(["new", "old"]);
  });

  it("stores exactly twelve house scores per object and replaces atomically", () => {
    insertObject(db, obj("a"));
    const v = houseVector(0.1);
    v[5] = 0.9;
    setHouseScores(db, "a", v);
    expect(getHouseScores(db, "a")).toEqual(v);
    expect(db.prepare("SELECT COUNT(*) AS n FROM house_scores WHERE object_id = 'a'").get()).toEqual({ n: 12 });

    const v2 = houseVector(0.3);
    setHouseScores(db, "a", v2);
    expect(getHouseScores(db, "a")).toEqual(v2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM house_scores").get()).toEqual({ n: 12 });

    expect(() => setHouseScores(db, "a", { ...v, 5: 1.5 })).toThrow();
    expect(getHouseScores(db, "missing")).toBeNull();
  });

  it("upserts concepts by normalized name and links them to objects", () => {
    insertObject(db, obj("a"));
    const c1 = upsertConcept(db, "AI Memory", T);
    const c2 = upsertConcept(db, "  ai   memory ", T);
    expect(c2.id).toBe(c1.id);
    expect(c1.normalizedName).toBe("ai memory");
    attachConcept(db, "a", c1.id);
    attachConcept(db, "a", c1.id);
    expect(listConceptsForObject(db, "a")).toEqual([c1]);
  });

  it("persists relations, rejects self-links, and transitions status", () => {
    insertObject(db, obj("a"));
    insertObject(db, obj("b"));
    const rel = insertRelation(db, { id: "r1", sourceId: "a", targetId: "b", type: "supports", confidence: 0.8, rationale: null, origin: "ai_inferred", status: "proposed", createdAt: T });
    expect(getRelation(db, "r1")).toEqual(rel);
    expect(listRelationsForObject(db, "b")).toHaveLength(1);

    expect(() => insertRelation(db, { ...rel, id: "r2", targetId: "a" })).toThrow();
    expect(() => db.prepare("INSERT INTO relations (id, source_id, target_id, type, confidence, origin, status, created_at) VALUES ('r3','a','a','supports',0.5,'user','proposed',?)").run(T)).toThrow();

    setRelationStatus(db, "r1", "accepted");
    expect(getRelation(db, "r1")?.status).toBe("accepted");
    expect(() => setRelationStatus(db, "nope", "accepted")).toThrow();
  });

  it("persists claims per object", () => {
    insertObject(db, obj("a"));
    const claim = insertClaim(db, { id: "c1", objectId: "a", normalizedClaim: "x is y", subject: "x", predicate: "is", objectText: "y", polarity: "positive", scope: null, confidence: 0.7, validFrom: null, validTo: null }, T);
    expect(listClaimsForObject(db, "a")).toEqual([claim]);
  });

  it("appends and retrieves events in order with filters", () => {
    insertObject(db, obj("a"));
    appendEvent(db, { type: "OBJECT_CAPTURED", objectId: "a", createdAt: "2026-09-16T10:00:00.000Z" });
    appendEvent(db, { type: "OBJECT_EXTRACTED", objectId: "a", payload: { concepts: 2 }, createdAt: "2026-09-16T10:00:01.000Z" });
    appendEvent(db, { type: "HOUSE_CLASSIFIED", objectId: "a", createdAt: "2026-09-16T10:00:02.000Z" });
    appendEvent(db, { type: "FEEDBACK_RECORDED", objectId: null, payload: { action: "useful" }, createdAt: "2026-09-16T10:00:03.000Z" });

    expect(listEvents(db).map((e) => e.type)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED", "FEEDBACK_RECORDED"]);
    expect(listEvents(db, { objectId: "a" })).toHaveLength(3);
    expect(listEvents(db, { type: "OBJECT_EXTRACTED" })[0].payload).toEqual({ concepts: 2 });
    expect(() => appendEvent(db, { type: "OBJECT_DELETED" as never })).toThrow();
  });

  it("persists operator runs and feedback", () => {
    insertObject(db, obj("a"));
    const run = insertOperatorRun(db, { id: "run1", objectId: "a", operator: "jupiter_expand", inputContext: { focus: "a" }, result: { possibilities: [] }, createdAt: T });
    expect(getOperatorRun(db, "run1")).toEqual(run);
    expect(listOperatorRunsForObject(db, "a")).toEqual([run]);
    expect(() => insertOperatorRun(db, { ...run, id: "run2", operator: "venus_harmonize" as never })).toThrow();

    const fb = insertFeedback(db, { id: "f1", targetType: "operator_run", targetId: "run1", action: "useful", createdAt: T });
    expect(listFeedbackForTarget(db, "operator_run", "run1")).toEqual([fb]);
    expect(() => insertFeedback(db, { ...fb, id: "f2", action: "liked" as never })).toThrow();
  });

  it("enforces foreign keys and cascades", () => {
    insertObject(db, obj("a"));
    expect(() =>
      insertRelation(db, { id: "r1", sourceId: "a", targetId: "ghost", type: "supports", confidence: 0.8, rationale: null, origin: "user", status: "proposed", createdAt: T }),
    ).toThrow();
    expect(() => setHouseScores(db, "ghost", houseVector(0.1))).toThrow();

    setHouseScores(db, "a", houseVector(0.1));
    insertClaim(db, { id: "c1", objectId: "a", normalizedClaim: "x", subject: null, predicate: null, objectText: null, polarity: "unknown", scope: null, confidence: 0.5, validFrom: null, validTo: null }, T);
    appendEvent(db, { type: "OBJECT_CAPTURED", objectId: "a" });

    db.prepare("DELETE FROM objects WHERE id = 'a'").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM house_scores").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM claims").get()).toEqual({ n: 0 });
    // events are preserved with object_id set to NULL (ON DELETE SET NULL): history survives deletion
    expect(listEvents(db)).toHaveLength(1);
    expect(listEvents(db)[0].objectId).toBeNull();
  });
});

describe("persistence across close and reopen", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pcf-test-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("keeps objects, house scores, relations, and events after reopening the file", () => {
    const path = join(dir, "pcf.db");
    const db1 = openDatabase(path);
    runMigrations(db1);
    insertObject(db1, obj("a", { title: "kept" }));
    insertObject(db1, obj("b"));
    setHouseScores(db1, "a", houseVector(0.25));
    insertRelation(db1, { id: "r1", sourceId: "a", targetId: "b", type: "related_to", confidence: 0.6, rationale: null, origin: "user", status: "accepted", createdAt: T });
    appendEvent(db1, { type: "OBJECT_CAPTURED", objectId: "a" });
    db1.close();

    const db2 = openDatabase(path);
    expect(runMigrations(db2).applied).toEqual([]);
    expect(getObject(db2, "a")?.title).toBe("kept");
    expect(getHouseScores(db2, "a")).toEqual(houseVector(0.25));
    expect(listRelationsForObject(db2, "a")).toHaveLength(1);
    expect(listEvents(db2, { objectId: "a" })).toHaveLength(1);
    db2.close();
  });
});
