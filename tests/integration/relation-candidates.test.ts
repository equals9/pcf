import { describe, expect, it } from "vitest";
import type { PcfDatabase } from "../../lib/db/database";
import { attachConcept, upsertConcept } from "../../lib/db/repositories/concepts";
import { insertFeedback } from "../../lib/db/repositories/feedback";
import { insertObject, setHouseScores } from "../../lib/db/repositories/objects";
import { insertRelation } from "../../lib/db/repositories/relations";
import { houseVector } from "../../lib/domain/houses";
import type { HouseNumber, HouseVector } from "../../lib/domain/types";
import { houseSimilarity } from "../../lib/engine/relevance";
import { OBJECT_FEEDBACK_TARGET, selectRelationCandidates } from "../../lib/engine/relation-inference";
import { newTestDb } from "../fixtures/capture-fixtures";

// SPEC §17 candidate pool and §19 ranking, one component at a time. Candidate ids are chosen so that the
// deterministic tie-break (newer first, then id) would produce the opposite order, so only the component
// under test can explain the expected order.

const FOCUS_AT = "2026-09-10T00:00:00.000Z";
const day = (offset: number) => new Date(Date.parse(FOCUS_AT) + offset * 86_400_000).toISOString();

function houses(peaks: Partial<Record<HouseNumber, number>>): HouseVector {
  const v = houseVector(0.05);
  for (const [k, s] of Object.entries(peaks)) v[Number(k) as HouseNumber] = s as number;
  return v;
}

const FOCUS_HOUSES = houses({ 2: 0.9 });
const OTHER_HOUSES = houses({ 12: 0.9 });

function add(db: PcfDatabase, id: string, opts: { at: string; concepts?: string[]; vector?: HouseVector | null }) {
  insertObject(db, {
    id,
    type: "thought",
    content: `content of ${id}`,
    title: null,
    createdAt: opts.at,
    updatedAt: opts.at,
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
  });
  for (const name of opts.concepts ?? []) attachConcept(db, id, upsertConcept(db, name, opts.at).id);
  if (opts.vector !== null) setHouseScores(db, id, opts.vector ?? FOCUS_HOUSES);
}

function setup() {
  const db = newTestDb();
  add(db, "focus", { at: FOCUS_AT, concepts: ["alpha", "beta"], vector: FOCUS_HOUSES });
  return db;
}

const ids = (db: PcfDatabase) => selectRelationCandidates(db, "focus").map((c) => c.object.id);

describe("§17 candidate pool", () => {
  it("includes an old object that only shares a concept", () => {
    const db = setup();
    add(db, "shared-old", { at: day(-200), concepts: ["alpha"], vector: OTHER_HOUSES });
    add(db, "recent-1", { at: day(-2), concepts: ["zeta"], vector: OTHER_HOUSES });
    add(db, "recent-2", { at: day(-1), concepts: ["zeta"], vector: OTHER_HOUSES });
    add(db, "unrelated-old", { at: day(-300), concepts: ["zeta"], vector: OTHER_HOUSES });
    expect(ids(db).sort()).toEqual(["recent-1", "recent-2", "shared-old"]);
  });

  it("never includes the focus object", () => {
    const db = setup();
    add(db, "other", { at: day(-1), concepts: ["alpha"] });
    expect(ids(db)).toEqual(["other"]);
  });

  it("reports the exact house similarity for a partial overlap", () => {
    const db = setup();
    const partial = houses({ 2: 0.5, 7: 0.9 });
    add(db, "partial", { at: day(-1), concepts: ["alpha"], vector: partial });
    const [candidate] = selectRelationCandidates(db, "focus");
    expect(candidate.houseSimilarity).toBeCloseTo(houseSimilarity(FOCUS_HOUSES, partial), 12);
    expect(candidate.houseSimilarity).toBeGreaterThan(0.3);
    expect(candidate.houseSimilarity).toBeLessThan(0.9);
    expect(candidate.sharedConcepts).toEqual(["alpha"]);
  });
});

describe("§19 ranking, one component at a time", () => {
  it("C: more concept overlap ranks higher", () => {
    const db = setup();
    add(db, "zz-full", { at: day(-1), concepts: ["alpha", "beta"] });
    add(db, "aa-partial", { at: day(-1), concepts: ["alpha", "gamma", "delta"] });
    expect(ids(db)).toEqual(["zz-full", "aa-partial"]);
  });

  it("H: more house similarity ranks higher", () => {
    const db = setup();
    add(db, "zz-same-houses", { at: day(-1), concepts: ["alpha"], vector: FOCUS_HOUSES });
    add(db, "aa-partial-houses", { at: day(-1), concepts: ["alpha"], vector: houses({ 2: 0.5, 7: 0.9 }) });
    expect(ids(db)).toEqual(["zz-same-houses", "aa-partial-houses"]);
  });

  it("G: a direct accepted relation ranks higher", () => {
    const db = setup();
    add(db, "zz-linked", { at: day(-1), concepts: ["alpha"] });
    add(db, "aa-unlinked", { at: day(-1), concepts: ["alpha"] });
    insertRelation(db, {
      id: "r1",
      sourceId: "focus",
      targetId: "zz-linked",
      type: "supports",
      confidence: 0.9,
      rationale: null,
      origin: "user",
      status: "accepted",
      createdAt: FOCUS_AT,
    });
    expect(ids(db)).toEqual(["zz-linked", "aa-unlinked"]);
  });

  it("T: closer in time ranks higher, even when the other object is newer", () => {
    const db = setup();
    add(db, "zz-close-older", { at: day(-1), concepts: ["alpha"] });
    add(db, "aa-far-newer", { at: day(30), concepts: ["alpha"] });
    expect(ids(db)).toEqual(["zz-close-older", "aa-far-newer"]);
  });

  it("F: dismissed feedback on the object ranks lower", () => {
    const db = setup();
    add(db, "aa-dismissed", { at: day(-1), concepts: ["alpha"] });
    add(db, "zz-no-feedback", { at: day(-1), concepts: ["alpha"] });
    expect(OBJECT_FEEDBACK_TARGET).toBe("object");
    insertFeedback(db, { id: "f1", targetType: "object", targetId: "aa-dismissed", action: "dismissed", createdAt: FOCUS_AT });
    insertFeedback(db, { id: "f2", targetType: "operator_run", targetId: "zz-no-feedback", action: "dismissed", createdAt: FOCUS_AT });
    expect(ids(db)).toEqual(["zz-no-feedback", "aa-dismissed"]);
  });

  it("falls back to newer first, then id, when relevance is equal", () => {
    const db = setup();
    add(db, "bb", { at: day(-1), concepts: ["alpha"] });
    add(db, "aa", { at: day(-1), concepts: ["alpha"] });
    expect(ids(db)).toEqual(["aa", "bb"]);
  });
});
