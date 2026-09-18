import { describe, expect, it } from "vitest";
import type { PcfDatabase } from "../../lib/db/database";
import { insertClaim, listClaimsForObject } from "../../lib/db/repositories/claims";
import { attachConcept, listConceptsForObject, upsertConcept } from "../../lib/db/repositories/concepts";
import { listEvents } from "../../lib/db/repositories/events";
import { listFeedbackForTarget } from "../../lib/db/repositories/feedback";
import { getHouseScores, getObject, insertObject, setHouseScores, updateObject } from "../../lib/db/repositories/objects";
import { listOperatorRunsForObject } from "../../lib/db/repositories/operators";
import { insertRelation, listRelationsForObject } from "../../lib/db/repositories/relations";
import { COGNITIVE_OPERATORS } from "../../lib/domain/operators";
import { houseVector } from "../../lib/domain/houses";
import type { CognitiveOperator, HouseNumber, HouseVector, RelationStatus } from "../../lib/domain/types";
import { fallbackHouseVector } from "../../lib/engine/house-classifier";
import {
  MAX_ACT_STEPS,
  MAX_ASSUMPTIONS,
  MAX_CONNECTIONS,
  MAX_FAILURE_MODES,
  MAX_MISSING_EVIDENCE,
  MAX_POSSIBILITIES,
  MAX_RELATED_OBJECTS,
  OPERATOR_FEEDBACK_TARGET,
  buildRetrievalPacket,
  recordFeedback,
  runOperator,
  type RetrievalPacket,
} from "../../lib/engine/operator-runner";
import { PCF_OPERATING_CONSTRAINTS } from "../../lib/ai/prompts/operators";
import { count, newTestDb, steppingClock } from "../fixtures/capture-fixtures";
import { ACT_RESULT, CHALLENGE_RESULT, connectResult, expandResult, operatorDeps, operatorMock } from "../fixtures/operator-fixtures";

// SPEC §23: each operator reads a bounded retrieval packet, makes one reasoner call, and writes exactly one
// operator_run plus one OPERATOR_INVOKED event. It never edits the thought, its claims, its relations or its
// house scores.

const AT = "2026-09-17T12:00:00.000Z";
const day = (offset: number) => new Date(Date.parse(AT) + offset * 86_400_000).toISOString();

function houses(peaks: Partial<Record<HouseNumber, number>>): HouseVector {
  const v = houseVector(0.05);
  for (const [k, s] of Object.entries(peaks)) v[Number(k) as HouseNumber] = s as number;
  return v;
}

function add(
  db: PcfDatabase,
  id: string,
  opts: { at?: string; concepts?: string[]; vector?: HouseVector | null; claims?: string[]; status?: "active" | "archived" } = {},
) {
  const at = opts.at ?? AT;
  insertObject(db, {
    id,
    type: "thought",
    content: `content of ${id}`,
    title: `title of ${id}`,
    createdAt: at,
    updatedAt: at,
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
  });
  for (const name of opts.concepts ?? []) attachConcept(db, id, upsertConcept(db, name, at).id);
  if (opts.vector !== null) setHouseScores(db, id, opts.vector ?? houses({ 2: 0.9 }));
  (opts.claims ?? []).forEach((claim, index) =>
    insertClaim(
      db,
      {
        id: `${id}-claim-${index}`,
        objectId: id,
        normalizedClaim: claim,
        subject: null,
        predicate: null,
        objectText: null,
        polarity: "positive",
        scope: null,
        confidence: 0.6,
        validFrom: null,
        validTo: null,
      },
      at,
    ),
  );
  if (opts.status === "archived") updateObject(db, id, { status: "archived" }, at);
}

function relate(db: PcfDatabase, id: string, sourceId: string, targetId: string, status: RelationStatus = "proposed") {
  insertRelation(db, {
    id,
    sourceId,
    targetId,
    type: "related_to",
    confidence: 0.7,
    rationale: "seeded",
    origin: status === "proposed" ? "ai_inferred" : "user",
    status,
    createdAt: AT,
  });
}

function anchored(): PcfDatabase {
  const db = newTestDb();
  add(db, "anchor", { concepts: ["alpha", "beta"], claims: ["the anchor claims something"] });
  return db;
}

const packetOf = (db: PcfDatabase, id = "anchor"): RetrievalPacket => {
  const built = buildRetrievalPacket(db, id);
  if (!built.ok) throw new Error(`packet refused: ${built.failure.reason}`);
  return built.packet;
};

describe("§23 retrieval packet", () => {
  it("carries exactly the frozen categories", () => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"], claims: ["a related claim"] });
    relate(db, "r1", "anchor", "other");
    const packet = packetOf(db);

    expect(Object.keys(packet).sort()).toEqual(["claims", "concepts", "focus", "houseVector", "relatedObjects", "relations"]);
    expect(packet.focus.id).toBe("anchor");
    expect(packet.concepts.map((c) => c.name).sort()).toEqual(["alpha", "beta"]);
    expect(packet.houseVector).toEqual(getHouseScores(db, "anchor"));
    expect(packet.relatedObjects.map((o) => o.id)).toEqual(["other"]);
    expect(packet.relations.map((r) => r.id)).toEqual(["r1"]);
    expect(packet.claims.map((c) => c.id).sort()).toEqual(["anchor-claim-0", "other-claim-0"]);
  });

  it("never passes more than 8 related objects, and never the anchor itself", () => {
    const db = anchored();
    for (let i = 0; i < 20; i++) add(db, `c-${i}`, { at: day(-i), concepts: ["alpha", `topic-${i}`] });
    const packet = packetOf(db);
    expect(packet.relatedObjects).toHaveLength(MAX_RELATED_OBJECTS);
    expect(packet.relatedObjects.map((o) => o.id)).not.toContain("anchor");
    expect(new Set(packet.relatedObjects.map((o) => o.id)).size).toBe(MAX_RELATED_OBJECTS);
  });

  it("excludes unrelated and archived objects", () => {
    const db = anchored();
    add(db, "related", { concepts: ["alpha"] });
    add(db, "archived", { concepts: ["alpha"], status: "archived" });
    // Older than the two most recent objects, so only relevance could bring them in.
    add(db, "unrelated-old", { at: day(-400), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    add(db, "unrelated-older", { at: day(-500), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    const ids = packetOf(db).relatedObjects.map((o) => o.id);
    expect(ids).toContain("related");
    expect(ids).not.toContain("archived");
    expect(ids).not.toContain("unrelated-old");
    expect(ids).not.toContain("unrelated-older");
  });

  it("carries relations between packet objects only, with their status and provenance", () => {
    const db = anchored();
    add(db, "a", { concepts: ["alpha"] });
    add(db, "b", { concepts: ["alpha"] });
    add(db, "offscreen", { at: day(-900), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    relate(db, "r-proposed", "anchor", "a", "proposed");
    relate(db, "r-accepted", "anchor", "b", "accepted");
    relate(db, "r-rejected", "a", "b", "rejected");
    relate(db, "r-offscreen", "b", "offscreen", "accepted");

    const packet = packetOf(db);
    expect(packet.relations.map((r) => r.id).sort()).toEqual(["r-accepted", "r-proposed", "r-rejected"]);
    expect(packet.relations.find((r) => r.id === "r-proposed")).toMatchObject({ status: "proposed", origin: "ai_inferred" });
    expect(packet.relations.find((r) => r.id === "r-rejected")).toMatchObject({ status: "rejected" });
  });

  it("is deterministic for the same canonical state", () => {
    const db = anchored();
    for (let i = 0; i < 12; i++) add(db, `c-${i}`, { at: day(-i), concepts: ["alpha", `t-${i % 3}`], claims: [`claim ${i}`] });
    expect(JSON.stringify(packetOf(db))).toBe(JSON.stringify(packetOf(db)));
  });

  it("works for a bare thought with no concepts, claims or relations", () => {
    const db = newTestDb();
    add(db, "bare", { concepts: [] });
    const packet = packetOf(db, "bare");
    expect(packet).toMatchObject({ concepts: [], relatedObjects: [], relations: [], claims: [] });
    expect(packet.focus.id).toBe("bare");
  });

  it("works with the §13 fallback house vector", () => {
    const db = newTestDb();
    add(db, "fallback", { vector: fallbackHouseVector() });
    expect(packetOf(db, "fallback").houseVector).toEqual(fallbackHouseVector());
  });

  it("refuses an object with no house vector rather than inventing one", () => {
    const db = newTestDb();
    add(db, "unclassified", { vector: null });
    const built = buildRetrievalPacket(db, "unclassified");
    expect(built).toEqual({ ok: false, failure: { reason: "not_classified" } });
  });

  it("refuses an unknown object", () => {
    expect(buildRetrievalPacket(newTestDb(), "missing")).toEqual({ ok: false, failure: { reason: "object_not_found" } });
  });
});

describe("§23 frozen bounds", () => {
  it("uses the numbers SPEC §23 fixes", () => {
    expect(MAX_RELATED_OBJECTS).toBe(8);
    expect(MAX_CONNECTIONS).toBe(3);
    expect(MAX_POSSIBILITIES).toBe(3);
    expect(MAX_ASSUMPTIONS).toBe(5);
    expect(MAX_FAILURE_MODES).toBe(5);
    expect(MAX_MISSING_EVIDENCE).toBe(5);
    expect(MAX_ACT_STEPS).toBe(5);
  });
});

describe("§23 operator invocation", () => {
  it.each(COGNITIVE_OPERATORS)("persists one run and one OPERATOR_INVOKED event for %s", async (operator) => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"] });
    const reasoner = operatorMock(db, "anchor");
    const outcome = await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: operator as CognitiveOperator });

    expect(outcome.status).toBe("ok");
    const runs = listOperatorRunsForObject(db, "anchor");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ objectId: "anchor", operator });
    expect(runs[0].result).toEqual(outcome.status === "ok" ? outcome.run.result : null);
    expect(runs[0].inputContext).toMatchObject({ focusId: "anchor", relatedObjectIds: ["other"] });
    expect(listEvents(db, { type: "OPERATOR_INVOKED", objectId: "anchor" })).toHaveLength(1);
    expect(listEvents(db, { type: "OPERATOR_INVOKED" })[0].payload).toMatchObject({ runId: runs[0].id, operator });
    expect(reasoner.calls).toHaveLength(1);
  });

  it("sends the packet, and only the packet, to the reasoner", async () => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"] });
    // Old, unrelated, and not among the two most recent objects, so it must never reach the prompt.
    add(db, "hidden", { at: day(-500), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    add(db, "newer-1", { at: day(-1), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    add(db, "newer-2", { at: day(-2), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    const reasoner = operatorMock(db, "anchor");
    await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: "saturn_challenge" });

    const [call] = reasoner.calls;
    expect(call.task).toBe("saturn-challenge");
    expect(call.system).not.toContain("content of anchor");
    const sent = JSON.parse(call.prompt.slice(call.prompt.indexOf("{")));
    expect(Object.keys(sent).sort()).toEqual(["claims", "concepts", "focus", "houseVector", "relatedObjects", "relations"]);
    expect(call.prompt).not.toContain("content of hidden");
  });

  it("restricts Connect targets and Expand citations to packet objects", async () => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"] });
    const reasoner = operatorMock(db, "anchor");
    reasoner.setResponse("mercury-connect", connectResult("hidden-id"));
    const connect = await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: "mercury_connect" });
    expect(connect).toEqual({ status: "failed", errorKind: "invalid_output" });
    expect(reasoner.calls).toHaveLength(1);

    reasoner.setResponse("jupiter-expand", expandResult(["hidden-id"]));
    const expand = await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: "jupiter_expand" });
    expect(expand).toEqual({ status: "failed", errorKind: "invalid_output" });
    expect(count(db, "operator_runs")).toBe(0);
  });

  // The over-long fixtures use the literal §23 numbers, so a widened constant fails here.
  it.each([
    ["4 connections", "mercury_connect", "mercury-connect", { connections: Array.from({ length: 4 }, () => connectResult("other").connections[0]) }],
    ["4 possibilities", "jupiter_expand", "jupiter-expand", { possibilities: Array.from({ length: 4 }, () => expandResult(["anchor"]).possibilities[0]) }],
    ["6 assumptions", "saturn_challenge", "saturn-challenge", { ...CHALLENGE_RESULT, coreAssumptions: Array.from({ length: 6 }, (_, i) => `assumption ${i}`) }],
    ["6 failure modes", "saturn_challenge", "saturn-challenge", { ...CHALLENGE_RESULT, failureModes: Array.from({ length: 6 }, (_, i) => `failure ${i}`) }],
    ["6 missing-evidence items", "saturn_challenge", "saturn-challenge", { ...CHALLENGE_RESULT, missingEvidence: Array.from({ length: 6 }, (_, i) => `evidence ${i}`) }],
    ["6 steps", "mars_act", "mars-act", { ...ACT_RESULT, steps: Array.from({ length: 6 }, (_, i) => `step ${i}`) }],
  ])("rejects a result with %s", async (_label, operator, task, response) => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"] });
    const reasoner = operatorMock(db, "anchor");
    reasoner.setResponse(task as string, response as Record<string, unknown>);
    const outcome = await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: operator as CognitiveOperator });
    expect(outcome).toEqual({ status: "failed", errorKind: "invalid_output" });
    expect(count(db, "operator_runs")).toBe(0);
    expect(listEvents(db, { type: "OPERATOR_INVOKED" })).toEqual([]);
    // The adapter owns the single retry; the engine must not add another attempt.
    expect(reasoner.calls).toHaveLength(1);
  });

  it("records nothing when the reasoner is unavailable", async () => {
    const db = anchored();
    const reasoner = operatorMock(db, "anchor");
    reasoner.unavailable = true;
    expect(await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: "mars_act" })).toEqual({
      status: "failed",
      errorKind: "unavailable",
    });
    expect(count(db, "operator_runs")).toBe(0);
    expect(count(db, "events")).toBe(0);
    expect(reasoner.calls).toHaveLength(1);
  });

  it("refuses to run on an object with no house vector, without calling the reasoner", async () => {
    const db = newTestDb();
    add(db, "unclassified", { vector: null });
    const reasoner = operatorMock(db, "unclassified");
    expect(await runOperator(operatorDeps(db, reasoner), { objectId: "unclassified", operator: "saturn_challenge" })).toEqual({
      status: "unavailable",
      reason: "not_classified",
    });
    expect(reasoner.calls).toEqual([]);
    expect(count(db, "operator_runs")).toBe(0);
  });

  it("keeps every run: repeated invocations are historically distinct", async () => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"] });
    const deps = operatorDeps(db, operatorMock(db, "anchor"));
    for (const operator of ["saturn_challenge", "saturn_challenge", "mars_act"] as CognitiveOperator[]) {
      expect((await runOperator(deps, { objectId: "anchor", operator })).status).toBe("ok");
    }
    const runs = listOperatorRunsForObject(db, "anchor");
    expect(runs).toHaveLength(3);
    expect(new Set(runs.map((r) => r.id)).size).toBe(3);
    expect(runs.map((r) => r.operator)).toEqual(["saturn_challenge", "saturn_challenge", "mars_act"]);
    expect(listEvents(db, { type: "OPERATOR_INVOKED" })).toHaveLength(3);
  });

  it("changes nothing else in canonical state", async () => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"] });
    relate(db, "r1", "anchor", "other", "proposed");
    const before = {
      object: getObject(db, "anchor"),
      houses: getHouseScores(db, "anchor"),
      concepts: listConceptsForObject(db, "anchor"),
      claims: listClaimsForObject(db, "anchor"),
      relations: listRelationsForObject(db, "anchor"),
      relationCount: count(db, "relations"),
    };
    const deps = operatorDeps(db, operatorMock(db, "anchor"));
    for (const operator of COGNITIVE_OPERATORS) await runOperator(deps, { objectId: "anchor", operator });

    expect(getObject(db, "anchor")).toEqual(before.object);
    expect(getHouseScores(db, "anchor")).toEqual(before.houses);
    expect(listConceptsForObject(db, "anchor")).toEqual(before.concepts);
    expect(listClaimsForObject(db, "anchor")).toEqual(before.claims);
    expect(listRelationsForObject(db, "anchor")).toEqual(before.relations);
    expect(count(db, "relations")).toBe(before.relationCount);
    // Connect suggested a relation; it stays a suggestion.
    expect(listRelationsForObject(db, "anchor").every((r) => r.status === "proposed")).toBe(true);
  });
});

describe("§23D Act feasibility", () => {
  // The live preflight proposed editing a thought's raw text to see whether the edit propagated. Raw capture
  // is immutable (SPEC §15), so that experiment could never be run. Mars is told the real constraints.
  const MALFORMED = "Maybe memory should stay outside weights.Maybe memory should stay outside weights.Maybe memory sho";

  function withMalformedAnchor(): PcfDatabase {
    const db = newTestDb();
    insertObject(db, {
      id: "anchor",
      type: "idea",
      content: MALFORMED,
      title: "Memory outside weights",
      createdAt: AT,
      updatedAt: AT,
      lastActivatedAt: null,
      importance: 0.6,
      activation: 0.5,
      status: "active",
      provenance: "user",
    });
    attachConcept(db, "anchor", upsertConcept(db, "alpha", AT).id);
    setHouseScores(db, "anchor", houses({ 2: 0.9 }));
    add(db, "other", { concepts: ["alpha"] });
    return db;
  }

  it("states the frozen operating constraints to Act, in the system prompt and not in the packet", async () => {
    const db = withMalformedAnchor();
    const reasoner = operatorMock(db, "anchor");
    await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: "mars_act" });
    const [call] = reasoner.calls;

    expect(call.system).toContain(PCF_OPERATING_CONSTRAINTS);
    // The invariants Mars must respect, each stated rather than left to inference.
    expect(call.system).toMatch(/raw text is immutable/i);
    expect(call.system).toMatch(/never edited, replaced, corrected or deleted/i);
    expect(call.system).toMatch(/malformed, truncated or duplicated/i);
    expect(call.system).toMatch(/claims, relations, house scores and the event history are canonical/i);
    expect(call.system).toMatch(/accept or reject a proposed relation/i);
    expect(call.system).toMatch(/Nothing you propose is executed/i);
    expect(call.system).toMatch(/no step has been carried out yet/i);
    expect(call.system).toMatch(/nearest feasible experiment/i);
    expect(call.system).toMatch(/Never assume a capability exists/i);
    // Capturing a new thought is offered as the way to record a result.
    expect(call.system).toMatch(/capture a new thought/i);

    // The contract is fixed operator text: it must not be smuggled into the user-derived packet.
    expect(call.prompt).not.toContain(PCF_OPERATING_CONSTRAINTS);
    expect(call.prompt).not.toMatch(/operating constraints/i);
    // The malformed content still reaches Mars exactly as captured.
    const sent = JSON.parse(call.prompt.slice(call.prompt.indexOf("{")));
    expect(sent.focus.content).toBe(MALFORMED);
  });

  it("gives the other three operators the packet without the Act contract", async () => {
    const db = withMalformedAnchor();
    const reasoner = operatorMock(db, "anchor");
    for (const operator of ["mercury_connect", "jupiter_expand", "saturn_challenge"] as CognitiveOperator[]) {
      await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator });
    }
    for (const call of reasoner.calls) expect(call.system).not.toContain(PCF_OPERATING_CONSTRAINTS);
  });

  it("leaves the malformed raw thought exactly as captured", async () => {
    const db = withMalformedAnchor();
    const before = getObject(db, "anchor");
    const outcome = await runOperator(operatorDeps(db, operatorMock(db, "anchor")), { objectId: "anchor", operator: "mars_act" });
    expect(outcome.status).toBe("ok");
    expect(getObject(db, "anchor")).toEqual(before);
    expect(getObject(db, "anchor")?.content).toBe(MALFORMED);
    expect(count(db, "objects")).toBe(2);
    expect(listClaimsForObject(db, "anchor")).toEqual([]);
    expect(listRelationsForObject(db, "anchor")).toEqual([]);
    expect(getHouseScores(db, "anchor")).toEqual(houses({ 2: 0.9 }));
  });

  it("stores an experiment that captures a new thought, and creates no thought itself", async () => {
    const db = withMalformedAnchor();
    const reasoner = operatorMock(db, "anchor");
    const feasible = {
      experimentTitle: "Log for a week whether memory needed correcting",
      hypothesis: "If stored memory matters, something will look wrong within a week.",
      smallestAction: "Each evening, read today's thoughts and capture a new thought noting anything that looked wrong.",
      steps: ["Read Today each evening.", "Capture a new thought recording what looked wrong, or that nothing did."],
      successCriterion: "At least one captured note describing something worth correcting.",
      failureCriterion: "Seven days with nothing worth noting.",
      evidenceToCapture: ["The captured notes themselves"],
    };
    reasoner.setResponse("mars-act", feasible);
    const outcome = await runOperator(operatorDeps(db, reasoner), { objectId: "anchor", operator: "mars_act" });

    expect(outcome.status).toBe("ok");
    expect(listOperatorRunsForObject(db, "anchor")[0].result).toEqual(feasible);
    // The proposal is recorded; the operator does not act on it.
    expect(count(db, "objects")).toBe(2);
    expect(listEvents(db, { type: "OBJECT_CAPTURED" })).toEqual([]);
  });
});

describe("§39 feedback", () => {
  it("records feedback on an operator run without touching the run", async () => {
    const db = anchored();
    add(db, "other", { concepts: ["alpha"] });
    const outcome = await runOperator(operatorDeps(db, operatorMock(db, "anchor")), { objectId: "anchor", operator: "mars_act" });
    if (outcome.status !== "ok") throw new Error("expected a run");
    const runBefore = listOperatorRunsForObject(db, "anchor")[0];

    const feedback = recordFeedback({ db, now: steppingClock("2026-09-17T13:00:00.000Z") }, {
      targetType: OPERATOR_FEEDBACK_TARGET,
      targetId: outcome.run.id,
      action: "useful",
    });
    expect(feedback).toMatchObject({ status: "ok" });
    expect(listFeedbackForTarget(db, OPERATOR_FEEDBACK_TARGET, outcome.run.id).map((f) => f.action)).toEqual(["useful"]);
    expect(listOperatorRunsForObject(db, "anchor")[0]).toEqual(runBefore);
    expect(listEvents(db, { type: "FEEDBACK_RECORDED" })[0]).toMatchObject({
      objectId: "anchor",
      payload: { targetType: OPERATOR_FEEDBACK_TARGET, targetId: outcome.run.id, action: "useful" },
    });
  });

  it("keeps every piece of feedback, in order", async () => {
    const db = anchored();
    const outcome = await runOperator(operatorDeps(db, operatorMock(db, "anchor")), { objectId: "anchor", operator: "saturn_challenge" });
    if (outcome.status !== "ok") throw new Error("expected a run");
    const deps = { db, now: steppingClock("2026-09-17T13:00:00.000Z") };
    recordFeedback(deps, { targetType: OPERATOR_FEEDBACK_TARGET, targetId: outcome.run.id, action: "useful" });
    recordFeedback(deps, { targetType: OPERATOR_FEEDBACK_TARGET, targetId: outcome.run.id, action: "not_useful" });
    expect(listFeedbackForTarget(db, OPERATOR_FEEDBACK_TARGET, outcome.run.id).map((f) => f.action)).toEqual(["useful", "not_useful"]);
  });

  it("refuses feedback on a target that does not exist", () => {
    const db = anchored();
    expect(recordFeedback({ db }, { targetType: OPERATOR_FEEDBACK_TARGET, targetId: "missing", action: "useful" })).toEqual({
      status: "target_not_found",
    });
    expect(recordFeedback({ db }, { targetType: "object", targetId: "missing", action: "useful" })).toEqual({ status: "target_not_found" });
    expect(count(db, "feedback")).toBe(0);
    expect(count(db, "events")).toBe(0);
  });

  it("records feedback on an object", () => {
    const db = anchored();
    const outcome = recordFeedback({ db }, { targetType: "object", targetId: "anchor", action: "opened" });
    expect(outcome.status).toBe("ok");
    expect(listFeedbackForTarget(db, "object", "anchor").map((f) => f.action)).toEqual(["opened"]);
  });
});
