import { z } from "zod";
import { CONTRADICTION_SYSTEM, CONTRADICTION_TASK, buildContradictionPrompt } from "../ai/prompts/contradiction";
import { ReasonerError, type Reasoner } from "../ai/reasoner";
import type { PcfDatabase } from "../db/database";
import { getClaim, listClaimsForObject } from "../db/repositories/claims";
import { appendEvent, listEvents } from "../db/repositories/events";
import { insertFeedback } from "../db/repositories/feedback";
import { listRecentObjectIdsSharingConceptsWithClaims } from "../db/repositories/concepts";
import { getObject } from "../db/repositories/objects";
import { contradictionClassSchema, scoreSchema } from "../domain/schemas";
import type { Claim, CognitiveObject, ContradictionResult, FeedbackRecord } from "../domain/types";
import { newId } from "../utils/ids";
import { normalizeConceptName } from "../utils/text";

// SPEC.md §24 — contradiction detector. It only works on objects that have claims, compares a bounded set of
// claim pairs rather than everything against everything, and never decides which claim is correct. Results
// are recorded as events; no claim, relation or object is touched.

/** §24: keep the top 6 pairs. */
export const MAX_CLAIM_PAIRS = 6;
/** How many concept-sharing objects that actually hold claims are considered. Bounded for large stores. */
export const CANDIDATE_OBJECT_LIMIT = 40;
/** §24: a tension is surfaced only at or above this confidence. */
export const MIN_TENSION_CONFIDENCE = 0.65;
/** §24: classifications worth surfacing as a tension. */
export const SURFACEABLE_CLASSES = ["true_contradiction", "partial_tension", "temporal_change", "supersession"] as const;

export interface ClaimPair {
  a: Claim;
  b: Claim;
  /** 2 when subject and predicate both match, 1 when the subject matches, else 0. */
  priority: number;
}

export interface DetectionDeps {
  db: PcfDatabase;
  reasoner: Reasoner;
  now?: () => Date;
}

const normalized = (value: string | null) => (value === null ? null : normalizeConceptName(value));

/** A stable key for one unordered claim pair, used to match dismissals and avoid duplicates. */
export function pairKey(claimAId: string, claimBId: string): string {
  return [claimAId, claimBId].sort().join("|");
}

/**
 * §24 candidate selection: claims of other objects that share a normalized concept with this object,
 * paired with this object's claims, ranked by matching subject and predicate, top 6 kept.
 * Ties break on the newer counterpart claim's object, then the claim ids, so the choice is deterministic.
 */
export function selectClaimPairs(db: PcfDatabase, objectId: string): ClaimPair[] {
  const own = listClaimsForObject(db, objectId);
  if (own.length === 0) return [];

  // Bounded on objects that actually hold claims, so an empty object never consumes a candidate slot.
  const others = listRecentObjectIdsSharingConceptsWithClaims(db, objectId, CANDIDATE_OBJECT_LIMIT)
    .map((id) => getObject(db, id))
    .filter((object): object is CognitiveObject => object !== null);
  const classified = classifiedPairs(db);

  const pairs: ClaimPair[] = [];
  for (const mine of own) {
    for (const other of others) {
      for (const theirs of listClaimsForObject(db, other.id)) {
        // A pair is classified once, from whichever side is checked first.
        if (classified.has(pairKey(mine.id, theirs.id))) continue;
        const sameSubject = normalized(mine.subject) !== null && normalized(mine.subject) === normalized(theirs.subject);
        const samePredicate = normalized(mine.predicate) !== null && normalized(mine.predicate) === normalized(theirs.predicate);
        pairs.push({ a: mine, b: theirs, priority: sameSubject ? (samePredicate ? 2 : 1) : 0 });
      }
    }
  }

  return pairs
    .sort((x, y) => y.priority - x.priority || x.a.id.localeCompare(y.a.id) || x.b.id.localeCompare(y.b.id))
    .slice(0, MAX_CLAIM_PAIRS);
}

/** Claim pairs that already have a recorded verdict, whichever object's check produced it. */
export function classifiedPairs(db: PcfDatabase): Set<string> {
  const keys = new Set<string>();
  for (const event of listEvents(db, { type: "CONTRADICTION_DETECTED" })) {
    const payload = event.payload as { claimAId?: string; claimBId?: string; pairs?: string[] };
    if (typeof payload.claimAId === "string" && typeof payload.claimBId === "string") keys.add(pairKey(payload.claimAId, payload.claimBId));
    for (const key of payload.pairs ?? []) keys.add(key);
  }
  return keys;
}

/** Structured-output schema for one classification call: every supplied pair classified exactly once. */
export function contradictionOutputSchema(pairs: readonly ClaimPair[]) {
  const claimIds = [...new Set(pairs.flatMap((pair) => [pair.a.id, pair.b.id]))];
  if (claimIds.length === 0) throw new Error("contradiction classification needs at least one pair");
  const claimId = z.enum(claimIds as [string, ...string[]]);
  return z.object({
    results: z
      .array(
        z.object({
          claimAId: claimId,
          claimBId: claimId,
          classification: contradictionClassSchema,
          confidence: scoreSchema,
          explanation: z.string().trim().min(1),
          unresolvedQuestion: z.string().trim().min(1).nullable(),
        }),
      )
      .max(pairs.length),
  });
}

/** What the classifier sees: the claim texts and their frozen fields, nothing else. */
export function claimPairsPayload(pairs: readonly ClaimPair[]): unknown {
  const claim = (c: Claim) => ({
    id: c.id,
    claim: c.normalizedClaim,
    subject: c.subject,
    predicate: c.predicate,
    object: c.objectText,
    polarity: c.polarity,
    scope: c.scope,
    validFrom: c.validFrom,
    validTo: c.validTo,
  });
  return { pairs: pairs.map((pair) => ({ a: claim(pair.a), b: claim(pair.b) })) };
}

/** True when every claim pair this object can form has already been classified. */
export function alreadyChecked(db: PcfDatabase, objectId: string): boolean {
  if (listEvents(db, { type: "CONTRADICTION_DETECTED", objectId }).length === 0 && selectClaimPairs(db, objectId).length > 0) return false;
  return selectClaimPairs(db, objectId).length === 0;
}

export type DetectionOutcome =
  | { status: "checked"; results: ContradictionResult[] }
  | { status: "no_claims" }
  | { status: "no_candidates" }
  | { status: "already_checked" }
  | { status: "failed"; errorKind: string };

/**
 * Classify this object's claim pairs (§24) and record each verdict as a CONTRADICTION_DETECTED event, so the
 * check is never repeated for the object and the Tension card can be rebuilt from canonical history.
 * One reasoner call; the engine never retries. Nothing but events is written.
 */
export async function detectContradictions(deps: DetectionDeps, objectId: string): Promise<DetectionOutcome> {
  const { db } = deps;
  if (listClaimsForObject(db, objectId).length === 0) return { status: "no_claims" };
  const pairs = selectClaimPairs(db, objectId);
  if (pairs.length === 0) {
    return listEvents(db, { type: "CONTRADICTION_DETECTED", objectId }).length > 0 || classifiedPairs(db).size > 0
      ? { status: "already_checked" }
      : { status: "no_candidates" };
  }

  let out: { results: ContradictionResult[] };
  try {
    out = (await deps.reasoner.runStructured({
      task: CONTRADICTION_TASK,
      system: CONTRADICTION_SYSTEM,
      prompt: buildContradictionPrompt(claimPairsPayload(pairs)),
      schema: contradictionOutputSchema(pairs),
    })) as { results: ContradictionResult[] };
  } catch (err) {
    const errorKind = err instanceof ReasonerError ? err.kind : "unexpected";
    console.error(`[pcf contradiction] ${JSON.stringify({ operation: "detect", objectId, outcome: "failed", errorKind })}`);
    return { status: "failed", errorKind };
  }

  const at = (deps.now ?? (() => new Date()))().toISOString();
  const keys = new Set(pairs.map((pair) => pairKey(pair.a.id, pair.b.id)));
  const results = out.results.filter((result) => keys.has(pairKey(result.claimAId, result.claimBId)));
  try {
    db.transaction(() => {
      for (const result of results) {
        appendEvent(db, { type: "CONTRADICTION_DETECTED", objectId, payload: { ...result }, createdAt: at });
      }
      // A run that found nothing is still a completed check: record which pairs were classified so they are
      // never sent again, from either side.
      const recorded = new Set(results.map((result) => pairKey(result.claimAId, result.claimBId)));
      const unrecorded = pairs.map((pair) => pairKey(pair.a.id, pair.b.id)).filter((key) => !recorded.has(key));
      if (unrecorded.length > 0) {
        appendEvent(db, { type: "CONTRADICTION_DETECTED", objectId, payload: { pairs: unrecorded, results: [] }, createdAt: at });
      }
    }).immediate();
  } catch {
    return { status: "failed", errorKind: "persist" };
  }
  return { status: "checked", results };
}

export interface Tension {
  result: ContradictionResult;
  claimA: Claim;
  claimB: Claim;
  /** The thoughts the claims were extracted from, so §25F can open both of them, unmodified. */
  objectA: CognitiveObject;
  objectB: CognitiveObject;
  objectAId: string;
  objectBId: string;
}

const isSurfaceable = (result: ContradictionResult) =>
  (SURFACEABLE_CLASSES as readonly string[]).includes(result.classification) && result.confidence >= MIN_TENSION_CONFIDENCE;

/** Claim pairs the user has waved off with "Not a conflict". */
function dismissedPairs(db: PcfDatabase): Set<string> {
  return new Set(
    listEvents(db, { type: "CONTRADICTION_DISMISSED" }).map((event) => {
      const payload = event.payload as { claimAId?: string; claimBId?: string };
      return pairKey(payload.claimAId ?? "", payload.claimBId ?? "");
    }),
  );
}

/**
 * §25F: the highest-confidence unresolved tension, or null. Read-only: it replays the recorded verdicts and
 * never calls the reasoner. A pair whose claims or thoughts no longer exist, or that was dismissed, is
 * skipped.
 */
export function currentTension(db: PcfDatabase): Tension | null {
  const dismissed = dismissedPairs(db);
  let best: Tension | null = null;
  for (const event of listEvents(db, { type: "CONTRADICTION_DETECTED" })) {
    const payload = event.payload as Partial<ContradictionResult>;
    if (typeof payload.claimAId !== "string" || typeof payload.claimBId !== "string") continue;
    const result = payload as ContradictionResult;
    if (!isSurfaceable(result) || dismissed.has(pairKey(result.claimAId, result.claimBId))) continue;
    const claimA = getClaim(db, result.claimAId);
    const claimB = getClaim(db, result.claimBId);
    if (!claimA || !claimB) continue;
    const objectA = getObject(db, claimA.objectId);
    const objectB = getObject(db, claimB.objectId);
    if (!objectA || !objectB) continue;
    const tension: Tension = { result, claimA, claimB, objectA, objectB, objectAId: objectA.id, objectBId: objectB.id };
    if (best === null || result.confidence > best.result.confidence) best = tension;
  }
  return best;
}

/** Feedback on a tension is recorded against this target type, with the claim pair as its id. */
export const TENSION_FEEDBACK_TARGET = "contradiction";

export type DismissalOutcome = { status: "ok"; feedback: FeedbackRecord } | { status: "target_not_found" };

/**
 * §25F "Not a conflict": the user's judgement becomes history — one feedback record and one
 * CONTRADICTION_DISMISSED event, in a single transaction. The claims, their objects and the original
 * verdict are untouched; the tension simply stops being surfaced.
 */
export function dismissTension(
  db: PcfDatabase,
  input: { claimAId: string; claimBId: string },
  now: Date = new Date(),
): DismissalOutcome {
  const claimA = getClaim(db, input.claimAId);
  const claimB = getClaim(db, input.claimBId);
  if (!claimA || !claimB) return { status: "target_not_found" };

  const at = now.toISOString();
  const feedback: FeedbackRecord = {
    id: newId(),
    targetType: TENSION_FEEDBACK_TARGET,
    targetId: pairKey(input.claimAId, input.claimBId),
    action: "dismissed",
    createdAt: at,
  };
  db.transaction(() => {
    insertFeedback(db, feedback);
    appendEvent(db, {
      type: "CONTRADICTION_DISMISSED",
      objectId: claimA.objectId,
      payload: { claimAId: input.claimAId, claimBId: input.claimBId },
      createdAt: at,
    });
  }).immediate();
  return { status: "ok", feedback };
}

/** The most recent object with claims that has not been through the classifier yet, or null. */
export function pendingCheckObjectId(db: PcfDatabase, objectIds: readonly string[]): string | null {
  for (const objectId of objectIds) {
    if (listClaimsForObject(db, objectId).length === 0) continue;
    // Only unclassified pairs count as work: a pair already judged from the other side is done.
    if (selectClaimPairs(db, objectId).length === 0) continue;
    return objectId;
  }
  return null;
}
