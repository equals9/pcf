import { describe, expect, it } from "vitest";
import type { PcfDatabase } from "../../lib/db/database";
import { getClaim, insertClaim, listClaimsForObject } from "../../lib/db/repositories/claims";
import { attachConcept, listConceptsForObject, upsertConcept } from "../../lib/db/repositories/concepts";
import { appendEvent, listEvents } from "../../lib/db/repositories/events";
import { listFeedbackForTarget } from "../../lib/db/repositories/feedback";
import { getObject, insertObject, setHouseScores, updateObject } from "../../lib/db/repositories/objects";
import { listRelationsForObject } from "../../lib/db/repositories/relations";
import { houseVector } from "../../lib/domain/houses";
import type { Claim, ContradictionResult } from "../../lib/domain/types";
import {
  MAX_CLAIM_PAIRS,
  MIN_TENSION_CONFIDENCE,
  TENSION_FEEDBACK_TARGET,
  alreadyChecked,
  currentTension,
  detectContradictions,
  dismissTension,
  pairKey,
  pendingCheckObjectId,
  selectClaimPairs,
} from "../../lib/engine/contradiction";
import { count, newTestDb, steppingClock } from "../fixtures/capture-fixtures";
import { MockReasoner } from "../fixtures/mock-reasoner";

// SPEC §24: only objects with claims, bounded claim pairs, one classification call, and never a decision
// about which claim is correct. SPEC §32's contradiction fixture is the first test here.

const AT = "2026-09-18T12:00:00.000Z";

function addObject(db: PcfDatabase, id: string, concepts: string[], opts: { archived?: boolean; at?: string } = {}) {
  const at = opts.at ?? AT;
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
  if (opts.archived) updateObject(db, id, { status: "archived" }, at);
}

function addClaim(db: PcfDatabase, id: string, objectId: string, text: string, fields: Partial<Claim> = {}): Claim {
  return insertClaim(
    db,
    {
      id,
      objectId,
      normalizedClaim: text,
      subject: fields.subject ?? null,
      predicate: fields.predicate ?? null,
      objectText: fields.objectText ?? null,
      polarity: fields.polarity ?? "positive",
      scope: fields.scope ?? null,
      confidence: fields.confidence ?? 0.7,
      validFrom: null,
      validTo: null,
    },
    AT,
  );
}

/** SPEC §32 fixture: the two memory claims that genuinely contradict. */
function specFixture(): { db: PcfDatabase; reasoner: MockReasoner } {
  const db = newTestDb();
  addObject(db, "inside", ["AI memory", "model weights"]);
  addObject(db, "outside", ["AI memory", "model weights"]);
  addClaim(db, "claim-inside", "inside", "Personal AI memory should live inside model weights.", {
    subject: "personal AI memory",
    predicate: "should live inside",
    objectText: "model weights",
  });
  addClaim(db, "claim-outside", "outside", "Personal AI memory should remain outside model weights.", {
    subject: "personal AI memory",
    predicate: "should remain outside",
    objectText: "model weights",
  });
  const reasoner = new MockReasoner({
    responses: {
      "classify-contradictions": ({ prompt }) => {
        const sent = JSON.parse(prompt.slice(prompt.indexOf("{"))) as { pairs: Array<{ a: { id: string }; b: { id: string } }> };
        return {
          results: sent.pairs.map((pair) => ({
            claimAId: pair.a.id,
            claimBId: pair.b.id,
            classification: "true_contradiction",
            confidence: 0.9,
            explanation: "One says memory belongs inside the weights; the other says it must stay outside.",
            unresolvedQuestion: "Where should personal memory actually live?",
          })),
        };
      },
    },
  });
  return { db, reasoner };
}

describe("SPEC §32 contradiction test", () => {
  it("classifies the two memory claims as a true contradiction and surfaces the tension", async () => {
    const { db, reasoner } = specFixture();
    const outcome = await detectContradictions({ db, reasoner, now: steppingClock(AT) }, "outside");

    expect(outcome.status).toBe("checked");
    expect(reasoner.calls.map((c) => c.task)).toEqual(["classify-contradictions"]);
    const tension = currentTension(db)!;
    expect(tension.result.classification).toBe("true_contradiction");
    expect(tension.result.confidence).toBe(0.9);
    expect([tension.claimA.id, tension.claimB.id].sort()).toEqual(["claim-inside", "claim-outside"]);
    expect([tension.objectAId, tension.objectBId].sort()).toEqual(["inside", "outside"]);
    expect(listEvents(db, { type: "CONTRADICTION_DETECTED" })).toHaveLength(1);
  });
});

describe("§24 candidate selection", () => {
  it("only works on objects that have claims", async () => {
    const db = newTestDb();
    addObject(db, "no-claims", ["alpha"]);
    addObject(db, "other", ["alpha"]);
    addClaim(db, "c1", "other", "Something else.");
    const reasoner = new MockReasoner({ responses: { "classify-contradictions": { results: [] } } });
    expect(selectClaimPairs(db, "no-claims")).toEqual([]);
    expect(await detectContradictions({ db, reasoner }, "no-claims")).toEqual({ status: "no_claims" });
    expect(reasoner.calls).toEqual([]);
    expect(count(db, "events")).toBe(0);
  });

  it("pairs only with claims of objects sharing a concept, and never with itself", () => {
    const db = newTestDb();
    addObject(db, "focus", ["memory"]);
    addObject(db, "shares", ["memory"]);
    addObject(db, "unrelated", ["gardening"]);
    addClaim(db, "focus-1", "focus", "Memory belongs outside weights.");
    addClaim(db, "focus-2", "focus", "Memory should be inspectable.");
    addClaim(db, "shares-1", "shares", "Memory belongs inside weights.");
    addClaim(db, "unrelated-1", "unrelated", "Tomatoes need sun.");

    const pairs = selectClaimPairs(db, "focus");
    expect(pairs.map((p) => `${p.a.id}~${p.b.id}`).sort()).toEqual(["focus-1~shares-1", "focus-2~shares-1"]);
  });

  it("prioritizes matching subject and predicate, and keeps at most 6 pairs", () => {
    const db = newTestDb();
    addObject(db, "focus", ["memory"]);
    addClaim(db, "focus-1", "focus", "Memory belongs outside weights.", { subject: "Memory", predicate: "belongs outside" });
    for (let i = 0; i < 10; i++) {
      addObject(db, `other-${i}`, ["memory"]);
      addClaim(db, `other-${i}-claim`, `other-${i}`, `Claim ${i}`, {
        // Only the last two match on subject, and only the very last on predicate too.
        subject: i >= 8 ? "memory" : "something else",
        predicate: i === 9 ? "Belongs Outside" : "does something",
      });
    }
    const pairs = selectClaimPairs(db, "focus");
    // Pinned to the frozen §24 number, not to the constant, so raising the cap fails here.
    expect(MAX_CLAIM_PAIRS).toBe(6);
    expect(pairs).toHaveLength(6);
    expect(pairs[0].b.id).toBe("other-9-claim");
    expect(pairs[0].priority).toBe(2);
    expect(pairs[1].priority).toBe(1);
  });

  it("ignores archived objects", () => {
    const db = newTestDb();
    addObject(db, "focus", ["memory"]);
    addObject(db, "archived", ["memory"], { archived: true });
    addClaim(db, "focus-1", "focus", "A claim.");
    addClaim(db, "archived-1", "archived", "Another claim.");
    expect(selectClaimPairs(db, "focus")).toEqual([]);
  });

  it("is deterministic for the same state", () => {
    const { db } = specFixture();
    expect(JSON.stringify(selectClaimPairs(db, "outside"))).toBe(JSON.stringify(selectClaimPairs(db, "outside")));
  });
});

describe("§24 detection", () => {
  it("records one verdict per pair and never repeats the check", async () => {
    const { db, reasoner } = specFixture();
    await detectContradictions({ db, reasoner }, "outside");
    expect(alreadyChecked(db, "outside")).toBe(true);

    const again = await detectContradictions({ db, reasoner }, "outside");
    expect(again).toEqual({ status: "already_checked" });
    expect(reasoner.calls).toHaveLength(1);
    expect(listEvents(db, { type: "CONTRADICTION_DETECTED" })).toHaveLength(1);
  });

  it("records a completed check even when nothing was found", async () => {
    const db = newTestDb();
    addObject(db, "focus", ["memory"]);
    addObject(db, "other", ["memory"]);
    addClaim(db, "focus-1", "focus", "A claim.");
    addClaim(db, "other-1", "other", "An unrelated claim.");
    const reasoner = new MockReasoner({
      responses: {
        "classify-contradictions": ({ prompt }) => {
          const sent = JSON.parse(prompt.slice(prompt.indexOf("{"))) as { pairs: Array<{ a: { id: string }; b: { id: string } }> };
          return {
            results: sent.pairs.map((pair) => ({
              claimAId: pair.a.id,
              claimBId: pair.b.id,
              classification: "none",
              confidence: 0.9,
              explanation: "They are about different things.",
              unresolvedQuestion: null,
            })),
          };
        },
      },
    });

    expect((await detectContradictions({ db, reasoner }, "focus")).status).toBe("checked");
    expect(alreadyChecked(db, "focus")).toBe(true);
    expect(currentTension(db)).toBeNull();
    expect((await detectContradictions({ db, reasoner }, "focus")).status).toBe("already_checked");
    expect(reasoner.calls).toHaveLength(1);
  });

  it("writes nothing when the reasoner fails, and can be retried later", async () => {
    const { db } = specFixture();
    const reasoner = new MockReasoner({ unavailable: true });
    expect(await detectContradictions({ db, reasoner }, "outside")).toEqual({ status: "failed", errorKind: "unavailable" });
    expect(count(db, "events")).toBe(0);
    expect(alreadyChecked(db, "outside")).toBe(false);
    expect(reasoner.calls).toHaveLength(1);
  });

  it("rejects output that classifies a pair outside the supplied set", async () => {
    const { db } = specFixture();
    const reasoner = new MockReasoner({
      responses: {
        "classify-contradictions": {
          results: [
            {
              claimAId: "claim-outside",
              claimBId: "not-a-real-claim",
              classification: "true_contradiction",
              confidence: 0.9,
              explanation: "Invented pair.",
              unresolvedQuestion: null,
            },
          ],
        },
      },
    });
    expect(await detectContradictions({ db, reasoner }, "outside")).toEqual({ status: "failed", errorKind: "invalid_output" });
    expect(count(db, "events")).toBe(0);
  });

  it("changes no claim, object, relation or house score", async () => {
    const { db, reasoner } = specFixture();
    const before = {
      objects: [getObject(db, "inside"), getObject(db, "outside")],
      claims: [...listClaimsForObject(db, "inside"), ...listClaimsForObject(db, "outside")],
      concepts: listConceptsForObject(db, "outside"),
      relations: listRelationsForObject(db, "outside"),
      houseRows: count(db, "house_scores"),
    };
    await detectContradictions({ db, reasoner }, "outside");

    expect([getObject(db, "inside"), getObject(db, "outside")]).toEqual(before.objects);
    expect([...listClaimsForObject(db, "inside"), ...listClaimsForObject(db, "outside")]).toEqual(before.claims);
    expect(listConceptsForObject(db, "outside")).toEqual(before.concepts);
    expect(listRelationsForObject(db, "outside")).toEqual(before.relations);
    expect(count(db, "house_scores")).toBe(before.houseRows);
    expect(listEvents(db).map((e) => e.type)).toEqual(["CONTRADICTION_DETECTED"]);
  });
});

describe("§24 surfacing rules", () => {
  const verdict = (overrides: Partial<ContradictionResult>): ContradictionResult => ({
    claimAId: "claim-outside",
    claimBId: "claim-inside",
    classification: "true_contradiction",
    confidence: 0.9,
    explanation: "They conflict.",
    unresolvedQuestion: null,
    ...overrides,
  });

  function withVerdict(result: ContradictionResult): PcfDatabase {
    const { db } = specFixture();
    appendEvent(db, { type: "CONTRADICTION_DETECTED", objectId: "outside", payload: { ...result }, createdAt: AT });
    return db;
  }

  it.each([
    ["true_contradiction", true],
    ["partial_tension", true],
    ["temporal_change", true],
    ["supersession", true],
    ["scope_difference", false],
    ["none", false],
  ])("surfaces %s: %s", (classification, surfaced) => {
    const db = withVerdict(verdict({ classification: classification as ContradictionResult["classification"] }));
    expect(currentTension(db) !== null).toBe(surfaced);
  });

  it("requires confidence of at least 0.65", () => {
    expect(MIN_TENSION_CONFIDENCE).toBe(0.65);
    expect(currentTension(withVerdict(verdict({ confidence: 0.64 })))).toBeNull();
    expect(currentTension(withVerdict(verdict({ confidence: 0.65 })))).not.toBeNull();
  });

  it("shows only the highest-confidence tension", () => {
    const db = withVerdict(verdict({ confidence: 0.7 }));
    addObject(db, "third", ["AI memory"]);
    addClaim(db, "claim-third", "third", "Memory should be partly internal.");
    appendEvent(db, {
      type: "CONTRADICTION_DETECTED",
      objectId: "third",
      payload: { ...verdict({ claimAId: "claim-third", claimBId: "claim-inside", confidence: 0.95 }) },
      createdAt: AT,
    });
    expect(currentTension(db)!.result.confidence).toBe(0.95);
  });

  it("skips a verdict whose claim no longer exists", () => {
    const db = withVerdict(verdict({ claimBId: "vanished" }));
    expect(currentTension(db)).toBeNull();
  });

  it("carries both source thoughts, unmodified, so §25F can open them", () => {
    const db = withVerdict(verdict({}));
    const tension = currentTension(db)!;
    expect(tension.objectA).toEqual(getObject(db, tension.objectAId));
    expect(tension.objectB).toEqual(getObject(db, tension.objectBId));
    expect(tension.objectA.content).toBeTruthy();
    expect(tension.objectA.id).not.toBe(tension.objectB.id);
  });

  it("skips a verdict whose source thought is gone", () => {
    const db = withVerdict(verdict({}));
    db.prepare("DELETE FROM claims WHERE object_id = ?").run("inside");
    db.prepare("DELETE FROM objects WHERE id = ?").run("inside");
    expect(currentTension(db)).toBeNull();
  });
});

describe("§25F dismissal", () => {
  it("records the judgement as feedback and an event, and stops surfacing the tension", async () => {
    const { db, reasoner } = specFixture();
    await detectContradictions({ db, reasoner }, "outside");
    const tension = currentTension(db)!;
    const claimsBefore = [getClaim(db, "claim-inside"), getClaim(db, "claim-outside")];

    const outcome = dismissTension(db, { claimAId: tension.claimA.id, claimBId: tension.claimB.id }, new Date(AT));
    expect(outcome.status).toBe("ok");
    expect(currentTension(db)).toBeNull();

    const key = pairKey(tension.claimA.id, tension.claimB.id);
    expect(listFeedbackForTarget(db, TENSION_FEEDBACK_TARGET, key).map((f) => f.action)).toEqual(["dismissed"]);
    expect(listEvents(db, { type: "CONTRADICTION_DISMISSED" })).toHaveLength(1);
    // The claims, and the original verdict, are left exactly as they were.
    expect([getClaim(db, "claim-inside"), getClaim(db, "claim-outside")]).toEqual(claimsBefore);
    expect(listEvents(db, { type: "CONTRADICTION_DETECTED" })).toHaveLength(1);
  });

  it("refuses a pair whose claims do not exist", () => {
    const { db } = specFixture();
    expect(dismissTension(db, { claimAId: "claim-outside", claimBId: "missing" })).toEqual({ status: "target_not_found" });
    expect(count(db, "feedback")).toBe(0);
    expect(count(db, "events")).toBe(0);
  });
});

describe("pending checks", () => {
  it("names the newest object with unclassified pairs, and nothing once the pair is judged", async () => {
    const { db, reasoner } = specFixture();
    expect(pendingCheckObjectId(db, ["outside", "inside"])).toBe("outside");
    await detectContradictions({ db, reasoner }, "outside");

    // The pair was judged from the "outside" side, so the "inside" object has no work left: judging the
    // same two claims again would cost a second Claude call and record a second verdict.
    expect(pendingCheckObjectId(db, ["outside", "inside"])).toBeNull();
    expect(await detectContradictions({ db, reasoner }, "inside")).toEqual({ status: "already_checked" });
    expect(reasoner.calls).toHaveLength(1);
    expect(listEvents(db, { type: "CONTRADICTION_DETECTED" })).toHaveLength(1);
  });

  it("classifies a genuinely new pair when a later thought arrives", async () => {
    const { db, reasoner } = specFixture();
    await detectContradictions({ db, reasoner }, "outside");

    addObject(db, "third", ["AI memory", "model weights"]);
    addClaim(db, "claim-third", "third", "Personal AI memory should live partly in both places.", {
      subject: "personal AI memory",
      predicate: "should live partly in",
      objectText: "both places",
    });
    expect(pendingCheckObjectId(db, ["third", "outside", "inside"])).toBe("third");
    const pairs = selectClaimPairs(db, "third").map((p) => pairKey(p.a.id, p.b.id));
    expect(pairs).toHaveLength(2);
    expect(pairs).not.toContain(pairKey("claim-inside", "claim-outside"));
  });

  it("skips objects with no claims or no candidate pairs", () => {
    const db = newTestDb();
    addObject(db, "bare", ["alpha"]);
    addObject(db, "lonely", ["beta"]);
    addClaim(db, "lonely-1", "lonely", "A claim with nothing to compare against.");
    expect(pendingCheckObjectId(db, ["bare", "lonely"])).toBeNull();
  });
});
