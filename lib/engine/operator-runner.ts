import { z } from "zod";
import { OPERATOR_PROMPTS, buildOperatorPrompt } from "../ai/prompts/operators";
import { ReasonerError, type Reasoner } from "../ai/reasoner";
import type { PcfDatabase } from "../db/database";
import { listClaimsForObject } from "../db/repositories/claims";
import { insertFeedback } from "../db/repositories/feedback";
import { listConceptsForObject } from "../db/repositories/concepts";
import { appendEvent } from "../db/repositories/events";
import { getHouseScores, getObject } from "../db/repositories/objects";
import { getOperatorRun, insertOperatorRun } from "../db/repositories/operators";
import { listRelationsForObject } from "../db/repositories/relations";
import { relationTypeSchema, scoreSchema } from "../domain/schemas";
import type { Claim, CognitiveObject, CognitiveOperator, Concept, FeedbackAction, FeedbackRecord, HouseVector, OperatorRun, Relation } from "../domain/types";
import { newId } from "../utils/ids";
import { selectRelationCandidates } from "./relation-inference";

// SPEC.md §23 — four cognitive operators over a bounded retrieval packet. An operator reads canonical state,
// makes exactly one reasoner call and writes one operator_run plus one OPERATOR_INVOKED event. It never
// edits the thought, its claims, its house scores or its relations: the result is its own artifact.

/** §23: "Maximum related objects passed to Claude: 8." */
export const MAX_RELATED_OBJECTS = 8;

/** §23 frozen result bounds. */
export const MAX_CONNECTIONS = 3;
export const MAX_POSSIBILITIES = 3;
export const MAX_ASSUMPTIONS = 5;
export const MAX_FAILURE_MODES = 5;
export const MAX_MISSING_EVIDENCE = 5;
export const MAX_ACT_STEPS = 5;

/** Feedback on an operator result is recorded against this target type. */
export const OPERATOR_FEEDBACK_TARGET = "operator_run";

/** SPEC §23 retrieval packet. The operator never sees anything else. */
export interface RetrievalPacket {
  focus: CognitiveObject;
  concepts: Concept[];
  houseVector: HouseVector;
  relatedObjects: CognitiveObject[];
  relations: Relation[];
  claims: Claim[];
}

export type PacketFailure = { reason: "object_not_found" } | { reason: "not_classified" };

export type PacketResult = { ok: true; packet: RetrievalPacket } | { ok: false; failure: PacketFailure };

/**
 * Assemble the §23 packet from canonical state only.
 * - related objects: the §17 candidates for this object, already ranked by §19 relevance and capped at 8.
 * - relations: every persisted relation, with its status, between two objects in the packet.
 * - claims: the claims of the focus and of the related objects.
 * An object with no house vector cannot be described honestly, so the packet is refused rather than filled
 * with a fabricated vector.
 */
export function buildRetrievalPacket(db: PcfDatabase, objectId: string): PacketResult {
  const focus = getObject(db, objectId);
  if (!focus) return { ok: false, failure: { reason: "object_not_found" } };
  const houseVector = getHouseScores(db, objectId);
  if (!houseVector) return { ok: false, failure: { reason: "not_classified" } };

  // §17 candidates, already ranked by §19 relevance. Archived thoughts are left out: the user put them
  // away, so they are not context for a new cognitive operation.
  const relatedObjects = selectRelationCandidates(db, objectId)
    .map((candidate) => candidate.object)
    .filter((object) => object.status !== "archived")
    .slice(0, MAX_RELATED_OBJECTS);

  const visible = new Set([focus.id, ...relatedObjects.map((o) => o.id)]);
  const relations: Relation[] = [];
  const seen = new Set<string>();
  for (const id of visible) {
    for (const relation of listRelationsForObject(db, id)) {
      if (seen.has(relation.id) || !visible.has(relation.sourceId) || !visible.has(relation.targetId)) continue;
      seen.add(relation.id);
      relations.push(relation);
    }
  }

  const claims = [focus, ...relatedObjects].flatMap((object) => listClaimsForObject(db, object.id));

  return {
    ok: true,
    packet: { focus, concepts: listConceptsForObject(db, objectId), houseVector, relatedObjects, relations, claims },
  };
}

/** What is recorded as the run's input context: ids only, so the packet stays reconstructable from canonical state. */
export function packetContext(packet: RetrievalPacket): Record<string, unknown> {
  return {
    focusId: packet.focus.id,
    conceptIds: packet.concepts.map((c) => c.id),
    houseVector: packet.houseVector,
    relatedObjectIds: packet.relatedObjects.map((o) => o.id),
    relationIds: packet.relations.map((r) => r.id),
    claimIds: packet.claims.map((c) => c.id),
  };
}

const text = z.string().trim().min(1);

/** §23A ConnectResult. Targets are restricted to the objects actually supplied in the packet. */
export function connectResultSchema(relatedObjectIds: readonly string[]) {
  const targetId = relatedObjectIds.length > 0 ? z.enum(relatedObjectIds as [string, ...string[]]) : z.never();
  return z.object({
    connections: z
      .array(
        z.object({
          targetId,
          relationType: relationTypeSchema,
          explanation: text,
          whyNonObvious: text,
          confidence: scoreSchema,
        }),
      )
      .max(MAX_CONNECTIONS),
  });
}

/** §23B ExpandResult. */
export function expandResultSchema(packetObjectIds: readonly string[]) {
  const objectId = z.enum(packetObjectIds as [string, ...string[]]);
  return z.object({
    possibilities: z
      .array(
        z.object({
          title: text,
          hypothesis: text,
          groundedInObjectIds: z.array(objectId).min(1),
          bridgeExplanation: text,
          whyNovel: text,
          nextQuestion: text,
        }),
      )
      .max(MAX_POSSIBILITIES),
  });
}

/** §23C ChallengeResult. */
export const challengeResultSchema = z.object({
  coreAssumptions: z.array(text).max(MAX_ASSUMPTIONS),
  strongestObjection: text,
  failureModes: z.array(text).max(MAX_FAILURE_MODES),
  missingEvidence: z.array(text).max(MAX_MISSING_EVIDENCE),
  alternativeInterpretation: z.string().trim().min(1).nullable(),
  confidenceAssessment: z.object({ currentEstimate: scoreSchema, rationale: text }),
});

/** §23D ActResult. */
export const actResultSchema = z.object({
  experimentTitle: text,
  hypothesis: text,
  smallestAction: text,
  steps: z.array(text).max(MAX_ACT_STEPS),
  successCriterion: text,
  failureCriterion: text,
  evidenceToCapture: z.array(text),
});

/** The output contract for one operator, given what the packet supplied. */
export function operatorSchema(operator: CognitiveOperator, packet: RetrievalPacket): z.ZodType<Record<string, unknown>> {
  const relatedIds = packet.relatedObjects.map((o) => o.id);
  switch (operator) {
    case "mercury_connect":
      return connectResultSchema(relatedIds) as unknown as z.ZodType<Record<string, unknown>>;
    case "jupiter_expand":
      return expandResultSchema([packet.focus.id, ...relatedIds]) as unknown as z.ZodType<Record<string, unknown>>;
    case "saturn_challenge":
      return challengeResultSchema as unknown as z.ZodType<Record<string, unknown>>;
    case "mars_act":
      return actResultSchema as unknown as z.ZodType<Record<string, unknown>>;
  }
}

/** SPEC §29 log entry for one operator invocation. Never content. */
export interface OperatorLogEntry {
  operator: CognitiveOperator;
  objectId: string;
  outcome: "ok" | "failed";
  errorKind?: string;
  durationMs: number;
}

export interface OperatorDeps {
  db: PcfDatabase;
  reasoner: Reasoner;
  now?: () => Date;
  log?: (entry: OperatorLogEntry) => void;
}

export type OperatorOutcome =
  | { status: "ok"; run: OperatorRun; packetObjects: CognitiveObject[] }
  | { status: "unavailable"; reason: PacketFailure["reason"] }
  | { status: "failed"; errorKind: string };

function defaultLog(entry: OperatorLogEntry): void {
  if (entry.outcome === "ok") return;
  console.error(`[pcf operator] ${JSON.stringify(entry)}`);
}

/**
 * One operator invocation (SPEC §23): build the packet, make exactly one reasoner call, and — only on a
 * validated result — commit the run and its OPERATOR_INVOKED event in one transaction. The engine never
 * retries; the reasoner retries malformed output at most once. A failure writes nothing at all.
 */
export async function runOperator(
  deps: OperatorDeps,
  input: { objectId: string; operator: CognitiveOperator },
): Promise<OperatorOutcome> {
  const { db, operator } = { ...deps, operator: input.operator };
  const log = deps.log ?? defaultLog;
  const started = Date.now();

  const built = buildRetrievalPacket(db, input.objectId);
  if (!built.ok) {
    log({ operator, objectId: input.objectId, outcome: "failed", errorKind: built.failure.reason, durationMs: Date.now() - started });
    return { status: "unavailable", reason: built.failure.reason };
  }

  const { packet } = built;
  const { task, system } = OPERATOR_PROMPTS[operator];
  let result: Record<string, unknown>;
  try {
    result = await deps.reasoner.runStructured({
      task,
      system,
      prompt: buildOperatorPrompt(packet),
      schema: operatorSchema(operator, packet),
    });
  } catch (err) {
    const errorKind = err instanceof ReasonerError ? err.kind : "unexpected";
    log({ operator, objectId: input.objectId, outcome: "failed", errorKind, durationMs: Date.now() - started });
    return { status: "failed", errorKind };
  }

  const at = (deps.now ?? (() => new Date()))().toISOString();
  const run: OperatorRun = {
    id: newId(),
    objectId: packet.focus.id,
    operator,
    inputContext: packetContext(packet),
    result,
    createdAt: at,
  };
  try {
    db.transaction(() => {
      insertOperatorRun(db, run);
      appendEvent(db, {
        type: "OPERATOR_INVOKED",
        objectId: packet.focus.id,
        payload: { runId: run.id, operator },
        createdAt: at,
      });
    }).immediate();
  } catch {
    log({ operator, objectId: input.objectId, outcome: "failed", errorKind: "persist", durationMs: Date.now() - started });
    return { status: "failed", errorKind: "persist" };
  }

  log({ operator, objectId: input.objectId, outcome: "ok", durationMs: Date.now() - started });
  return { status: "ok", run, packetObjects: [packet.focus, ...packet.relatedObjects] };
}

/** Targets a user can give feedback on in v0.1: an operator result, or a thought. */
export const FEEDBACK_TARGET_TYPES = [OPERATOR_FEEDBACK_TARGET, "object"] as const;
export type FeedbackTargetType = (typeof FEEDBACK_TARGET_TYPES)[number];

export type FeedbackOutcome = { status: "ok"; feedback: FeedbackRecord } | { status: "target_not_found" };

/**
 * Record one piece of user feedback (SPEC §11 FEEDBACK_RECORDED, §39). Feedback is canonical user evidence:
 * it is stored beside the operator result and never changes it, and v0.1 learns nothing from it.
 */
export function recordFeedback(
  deps: Pick<OperatorDeps, "db" | "now">,
  input: { targetType: FeedbackTargetType; targetId: string; action: FeedbackAction },
): FeedbackOutcome {
  const { db } = deps;
  const objectId =
    input.targetType === OPERATOR_FEEDBACK_TARGET ? getOperatorRun(db, input.targetId)?.objectId : getObject(db, input.targetId)?.id;
  if (!objectId) return { status: "target_not_found" };

  const at = (deps.now ?? (() => new Date()))().toISOString();
  const feedback: FeedbackRecord = { id: newId(), targetType: input.targetType, targetId: input.targetId, action: input.action, createdAt: at };
  db.transaction(() => {
    insertFeedback(db, feedback);
    appendEvent(db, {
      type: "FEEDBACK_RECORDED",
      objectId,
      payload: { targetType: input.targetType, targetId: input.targetId, action: input.action },
      createdAt: at,
    });
  }).immediate();
  return { status: "ok", feedback };
}
