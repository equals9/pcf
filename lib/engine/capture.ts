import { ReasonerError, type Reasoner } from "../ai/reasoner";
import type { PcfDatabase } from "../db/database";
import { insertClaim } from "../db/repositories/claims";
import { attachConcept, listConceptsForObject, upsertConcept } from "../db/repositories/concepts";
import { appendEvent, listEvents } from "../db/repositories/events";
import { getHouseScores, getObject, insertObject, setHouseScores, updateObject } from "../db/repositories/objects";
import { insertRelation, listRelationsForObject } from "../db/repositories/relations";
import type { Claim, CognitiveObject, Concept, HouseVector, Relation } from "../domain/types";
import { newId } from "../utils/ids";
import { runExtraction, type ExtractionResult } from "./extract";
import { classifyHouses, fallbackHouseVector } from "./house-classifier";
import {
  duplicatesExistingRelation,
  inferRelations,
  persistableProposals,
  selectRelationCandidates,
  type RelationCandidate,
  type RelationProposal,
} from "./relation-inference";

// SPEC.md §15 — capture pipeline.
//
// The raw thought is committed (object + OBJECT_CAPTURED) before any reasoner call. Every later stage
// commits in its own short transaction, so a failure in one stage never rolls back an earlier one, and an
// event is appended only when its stage's writes are committed. There is no pipeline-wide transaction.
// The pipeline never retries a reasoner call; the reasoner itself retries malformed output at most once.
// After the raw commit, enrichment failures are reported in the result, never thrown.

export type CaptureOperation = "extract" | "classify-houses" | "infer-relations";

/** SPEC §29 log entry: operation, object id, outcome, error type and duration only. Never content. */
export interface CaptureLogEntry {
  operation: CaptureOperation;
  objectId: string;
  outcome: "ok" | "failed" | "fallback" | "skipped";
  errorKind?: string;
  durationMs: number;
}

export interface CaptureDeps {
  db: PcfDatabase;
  reasoner: Reasoner;
  now?: () => Date;
  log?: (entry: CaptureLogEntry) => void;
}

/**
 * - `classified`: the model's vector is stored.
 * - `fallback`: the §13 fallback vector is stored.
 * - `failed`: not even the fallback could be written; the object has no house rows until a retry succeeds.
 */
export type HousesStatus = "classified" | "fallback" | "failed";

export interface EnrichmentStatus {
  /** `failed` leaves the object's metadata incomplete: it has no OBJECT_EXTRACTED event and can be retried. */
  extraction: "ok" | "failed";
  houses: HousesStatus;
  /** `none`: no candidates, so the reasoner was not called. `skipped`: the reasoner was unavailable earlier. */
  relations: "ok" | "none" | "failed" | "skipped";
}

/** SPEC §26 capture response, plus the enrichment status. `houseVector` is null only when houses are `failed`. */
export interface CaptureResult {
  object: CognitiveObject;
  houseVector: HouseVector | null;
  concepts: Concept[];
  relations: Relation[];
  enrichment: EnrichmentStatus;
}

export class CaptureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureValidationError";
  }
}

/**
 * The raw thought was committed, but the pipeline then failed unexpectedly (for example the database could
 * not be read back). The thought is stored under `objectId`.
 */
export class CaptureAfterSaveError extends Error {
  readonly objectId: string;

  constructor(objectId: string, cause: unknown) {
    super(`capture ${objectId} was stored, but the pipeline could not finish`, { cause });
    this.name = "CaptureAfterSaveError";
    this.objectId = objectId;
  }
}

/** Objects whose capture or retry is running in this process; a retry never overlaps them. */
const enriching = new Set<string>();

/** Default §13/§29 error log: one line per failure, fallback or skip, without any user content. */
function defaultLog(entry: CaptureLogEntry): void {
  if (entry.outcome === "ok") return;
  console.error(`[pcf capture] ${JSON.stringify(entry)}`);
}

function logger(deps: CaptureDeps): (entry: CaptureLogEntry) => void {
  return deps.log ?? defaultLog;
}

function timestamp(deps: CaptureDeps): string {
  return (deps.now ?? (() => new Date()))().toISOString();
}

type StageOutcome<W> = { ok: true; written: W } | { ok: false; errorKind: string; reasonerDown: boolean };

/**
 * One reasoner call followed by one committed write. Reasoner errors and write errors are logged and
 * reported, never thrown. After an unavailable or timed-out reasoner, or an unexpected error, the caller
 * stops making reasoner calls for this capture.
 */
async function runStage<T, W>(
  deps: CaptureDeps,
  operation: CaptureOperation,
  objectId: string,
  call: () => Promise<T>,
  persist: (value: T) => W,
): Promise<StageOutcome<W>> {
  const started = Date.now();
  let value: T;
  try {
    value = await call();
  } catch (err) {
    const errorKind = err instanceof ReasonerError ? err.kind : "unexpected";
    logger(deps)({ operation, objectId, outcome: "failed", errorKind, durationMs: Date.now() - started });
    return { ok: false, errorKind, reasonerDown: errorKind !== "invalid_output" };
  }
  let written: W;
  try {
    written = persist(value);
  } catch {
    logger(deps)({ operation, objectId, outcome: "failed", errorKind: "persist", durationMs: Date.now() - started });
    return { ok: false, errorKind: "persist", reasonerDown: false };
  }
  logger(deps)({ operation, objectId, outcome: "ok", durationMs: Date.now() - started });
  return { ok: true, written };
}

/** Steps 1–3: validate, then commit the raw thought before any AI work. Content is stored exactly as given. */
export function persistRawCapture(deps: CaptureDeps, content: unknown): CognitiveObject {
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new CaptureValidationError("capture content must be a non-empty string");
  }
  const at = timestamp(deps);
  const object: CognitiveObject = {
    id: newId(),
    type: "thought",
    content,
    title: null,
    createdAt: at,
    updatedAt: at,
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
  };
  deps.db.transaction(() => {
    insertObject(deps.db, object);
    appendEvent(deps.db, { type: "OBJECT_CAPTURED", objectId: object.id, payload: {}, createdAt: at });
  })();
  return object;
}

/** True when the object's extraction has been committed. Otherwise its metadata is incomplete (SPEC §28). */
export function isExtractionComplete(db: PcfDatabase, objectId: string): boolean {
  return listEvents(db, { type: "OBJECT_EXTRACTED", objectId }).length > 0;
}

/**
 * Steps 5–8 in one immediate transaction: metadata, concepts, claims, then OBJECT_EXTRACTED.
 * Returns false, writing nothing, when an extraction was already committed for the object.
 */
function persistExtraction(deps: CaptureDeps, objectId: string, result: ExtractionResult): boolean {
  const { db } = deps;
  const at = timestamp(deps);
  return db
    .transaction(() => {
      if (isExtractionComplete(db, objectId)) return false;
      updateObject(db, objectId, { type: result.type, title: result.title, importance: result.importanceEstimate }, at);
      const conceptIds: string[] = [];
      for (const { name } of result.concepts) {
        const concept = upsertConcept(db, name, at);
        attachConcept(db, objectId, concept.id);
        if (!conceptIds.includes(concept.id)) conceptIds.push(concept.id);
      }
      const claimIds: string[] = [];
      for (const c of result.claims) {
        const claim: Claim = { ...c, id: newId(), objectId, validFrom: null, validTo: null };
        insertClaim(db, claim, at);
        claimIds.push(claim.id);
      }
      appendEvent(db, {
        type: "OBJECT_EXTRACTED",
        objectId,
        payload: {
          objectType: result.type,
          conceptIds,
          claimIds,
          unresolved: result.unresolved,
          importanceEstimate: result.importanceEstimate,
        },
        createdAt: at,
      });
      return true;
    })
    .immediate();
}

/**
 * Steps 10–11 in one immediate transaction: all 12 house rows, then HOUSE_CLASSIFIED.
 * With `onlyIfMissing`, returns false and writes nothing when the object already has house rows.
 */
function persistHouses(
  deps: CaptureDeps,
  objectId: string,
  vector: HouseVector,
  payload: Record<string, unknown>,
  onlyIfMissing: boolean,
): boolean {
  const at = timestamp(deps);
  return deps.db
    .transaction(() => {
      if (onlyIfMissing && getHouseScores(deps.db, objectId)) return false;
      setHouseScores(deps.db, objectId, vector);
      appendEvent(deps.db, { type: "HOUSE_CLASSIFIED", objectId, payload, createdAt: at });
      return true;
    })
    .immediate();
}

/** Step 14 in one immediate transaction: proposed relations only, each followed by its RELATION_PROPOSED event. */
function persistProposals(deps: CaptureDeps, sourceId: string, proposals: readonly RelationProposal[]): void {
  const { db } = deps;
  const at = timestamp(deps);
  db.transaction(() => {
    for (const p of persistableProposals(proposals)) {
      if (duplicatesExistingRelation(listRelationsForObject(db, sourceId), sourceId, p)) continue;
      const relation = insertRelation(db, {
        id: newId(),
        sourceId,
        targetId: p.targetId,
        type: p.type,
        confidence: p.confidence,
        rationale: p.rationale,
        origin: "ai_inferred",
        status: "proposed",
        createdAt: at,
      });
      appendEvent(db, {
        type: "RELATION_PROPOSED",
        objectId: sourceId,
        payload: { relationId: relation.id, targetId: relation.targetId, relationType: relation.type, confidence: relation.confidence },
        createdAt: at,
      });
    }
  }).immediate();
}

type ExtractionStageResult = { status: "ok" | "failed" | "already_extracted"; reasonerDown: boolean };

async function extractionStage(deps: CaptureDeps, object: CognitiveObject): Promise<ExtractionStageResult> {
  const outcome = await runStage(
    deps,
    "extract",
    object.id,
    () => runExtraction(deps.reasoner, { content: object.content }),
    (result) => persistExtraction(deps, object.id, result),
  );
  if (!outcome.ok) return { status: "failed", reasonerDown: outcome.reasonerDown };
  return { status: outcome.written ? "ok" : "already_extracted", reasonerDown: false };
}

/** Steps 9–11: classify, or store the §13 fallback. Returns `failed` only if even the fallback cannot be written. */
async function housesStage(
  deps: CaptureDeps,
  id: string,
  reasonerDown: boolean,
  onlyIfMissing: boolean,
): Promise<{ houses: HousesStatus | "already_present"; reasonerDown: boolean }> {
  const { db } = deps;
  const log = logger(deps);
  let reason: string;
  if (reasonerDown) {
    reason = "reasoner_unavailable";
    log({ operation: "classify-houses", objectId: id, outcome: "skipped", errorKind: reason, durationMs: 0 });
  } else {
    const current = getObject(db, id);
    if (!current) return { houses: "failed", reasonerDown };
    const outcome = await runStage(
      deps,
      "classify-houses",
      id,
      () =>
        classifyHouses(deps.reasoner, {
          content: current.content,
          title: current.title,
          concepts: listConceptsForObject(db, id).map((c) => c.name),
        }),
      (out) =>
        persistHouses(deps, id, out.scores, { source: "model", dominantHouses: out.dominantHouses, rationale: out.rationale }, onlyIfMissing),
    );
    if (outcome.ok) return { houses: outcome.written ? "classified" : "already_present", reasonerDown };
    reason = outcome.errorKind;
    reasonerDown = outcome.reasonerDown;
  }

  log({ operation: "classify-houses", objectId: id, outcome: "fallback", errorKind: reason, durationMs: 0 });
  try {
    const written = persistHouses(deps, id, fallbackHouseVector(), { source: "fallback", reason }, onlyIfMissing);
    return { houses: written ? "fallback" : "already_present", reasonerDown };
  } catch {
    log({ operation: "classify-houses", objectId: id, outcome: "failed", errorKind: "persist", durationMs: 0 });
    return { houses: "failed", reasonerDown };
  }
}

/** Steps 12–14: bounded relation inference; proposals only. */
async function relationsStage(deps: CaptureDeps, id: string, reasonerDown: boolean): Promise<EnrichmentStatus["relations"]> {
  const { db } = deps;
  const log = logger(deps);
  if (reasonerDown) {
    log({ operation: "infer-relations", objectId: id, outcome: "skipped", errorKind: "reasoner_unavailable", durationMs: 0 });
    return "skipped";
  }
  let candidates: RelationCandidate[];
  let source: CognitiveObject | null;
  try {
    candidates = selectRelationCandidates(db, id);
    source = getObject(db, id);
  } catch {
    log({ operation: "infer-relations", objectId: id, outcome: "failed", errorKind: "candidates", durationMs: 0 });
    return "failed";
  }
  if (!source) return "failed";
  if (candidates.length === 0) return "none";
  const src = source;
  const outcome = await runStage(
    deps,
    "infer-relations",
    id,
    () => inferRelations(deps.reasoner, { source: src, candidates }),
    (proposals) => persistProposals(deps, id, proposals),
  );
  return outcome.ok ? "ok" : "failed";
}

/**
 * Full pipeline (SPEC §15). Throws `CaptureValidationError` for invalid input and the underlying error if the
 * raw capture itself cannot be stored; in both cases nothing was written. Any later unexpected error, such as
 * the database failing to read back, is thrown as `CaptureAfterSaveError`: the raw thought is already stored.
 * Enrichment failures are reported in `enrichment`, never thrown.
 */
export async function captureThought(deps: CaptureDeps, content: unknown): Promise<CaptureResult> {
  const { db } = deps;
  const raw = persistRawCapture(deps, content);
  const id = raw.id;
  enriching.add(id);
  try {
    const extraction = await extractionStage(deps, raw);
    const houses = await housesStage(deps, id, extraction.reasonerDown, false);
    const relations = await relationsStage(deps, id, houses.reasonerDown);

    // Step 15: return the full object as stored.
    return {
      object: getObject(db, id) ?? raw,
      houseVector: getHouseScores(db, id),
      concepts: listConceptsForObject(db, id),
      relations: listRelationsForObject(db, id),
      enrichment: {
        extraction: extraction.status === "failed" ? "failed" : "ok",
        houses: houses.houses === "already_present" ? "classified" : houses.houses,
        relations,
      },
    };
  } catch (err) {
    throw new CaptureAfterSaveError(id, err);
  } finally {
    enriching.delete(id);
  }
}

export type RetryResult =
  | { status: "in_progress" }
  | {
      status: "done";
      extraction: "ok" | "failed" | "already_extracted";
      houses: HousesStatus | "already_present";
    };

/**
 * SPEC §28 retry for an incomplete capture. Re-runs extraction if it has no committed result, then stores a
 * house vector if the object has none (classification, or the §13 fallback). Relation inference is not
 * re-run. Returns `in_progress` without doing anything while a capture or retry of the object is running in
 * this process; the transactions re-check completion, so overlapping work never writes twice.
 */
export async function retryIncompleteCapture(deps: CaptureDeps, objectId: string): Promise<RetryResult> {
  const object = getObject(deps.db, objectId);
  if (!object) throw new Error(`object not found: ${objectId}`);
  if (enriching.has(objectId)) return { status: "in_progress" };
  enriching.add(objectId);
  try {
    let extraction: ExtractionStageResult = { status: "already_extracted", reasonerDown: false };
    if (!isExtractionComplete(deps.db, objectId)) extraction = await extractionStage(deps, object);
    const houses = getHouseScores(deps.db, objectId)
      ? { houses: "already_present" as const }
      : await housesStage(deps, objectId, extraction.reasonerDown, true);
    return { status: "done", extraction: extraction.status, houses: houses.houses };
  } finally {
    enriching.delete(objectId);
  }
}
