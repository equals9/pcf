import { z } from "zod";
import { INFER_RELATIONS_SYSTEM, INFER_RELATIONS_TASK, buildInferRelationsPrompt } from "../ai/prompts/infer-relations";
import type { Reasoner } from "../ai/reasoner";
import type { PcfDatabase } from "../db/database";
import { listConceptsForObject, listObjectIdsSharingConcepts } from "../db/repositories/concepts";
import { listFeedbackForTarget } from "../db/repositories/feedback";
import { getHouseScores, getObject, listObjectIdsWithHouseScoreAtLeast, listRecentObjectIds } from "../db/repositories/objects";
import { listRelationsForObject } from "../db/repositories/relations";
import { relationTypeSchema, scoreSchema } from "../domain/schemas";
import type { CognitiveObject, RelationType } from "../domain/types";
import { DOMINANT_HOUSE_MIN_SCORE, housesAtOrAbove } from "./house-classifier";
import {
  conceptSimilarity,
  feedbackAffinity,
  graphRelationship,
  houseSimilarity,
  relevanceScore,
  temporalProximity,
} from "./relevance";

// SPEC.md §17 (candidate retrieval) and §18 (relation inference).

export const MAX_RELATION_CANDIDATES = 8;
export const RECENT_CANDIDATES = 2;
export const MAX_RELATION_PROPOSALS = 3;
export const MIN_RELATION_CONFIDENCE = 0.55;
/** Candidate text sent to the reasoner is cut to this length; the source thought is sent in full. */
export const CANDIDATE_CONTENT_CHARS = 600;
/** Feedback on a CognitiveObject is recorded with this target type. */
export const OBJECT_FEEDBACK_TARGET = "object";

export interface RelationCandidate {
  object: CognitiveObject;
  sharedConcepts: string[];
  houseSimilarity: number;
  relevance: number;
}

export interface RelationInferenceInput {
  source: CognitiveObject;
  candidates: Array<{ object: CognitiveObject; sharedConcepts: string[]; houseSimilarity: number }>;
}

export interface RelationProposal {
  targetId: string;
  type: RelationType;
  confidence: number;
  rationale: string;
}

/**
 * §17: objects sharing a concept, objects with significant house overlap (a house where both score at or
 * above the §13 dominant-house threshold), and up to two most recent objects; the new object excluded;
 * ranked by §19 relevance; at most 8 kept. Ties are broken by newer creation time, then id.
 */
export function selectRelationCandidates(db: PcfDatabase, focusId: string): RelationCandidate[] {
  const focus = getObject(db, focusId);
  if (!focus) throw new Error(`object not found: ${focusId}`);
  const focusConceptIds = listConceptsForObject(db, focusId).map((c) => c.id);
  const focusConceptSet = new Set(focusConceptIds);
  const focusHouses = getHouseScores(db, focusId);
  const focusRelations = listRelationsForObject(db, focusId);

  const pool = new Set<string>([
    ...listObjectIdsSharingConcepts(db, focusId),
    ...(focusHouses
      ? listObjectIdsWithHouseScoreAtLeast(db, housesAtOrAbove(focusHouses), DOMINANT_HOUSE_MIN_SCORE, focusId)
      : []),
    ...listRecentObjectIds(db, RECENT_CANDIDATES, focusId),
  ]);
  pool.delete(focusId);

  const scored: RelationCandidate[] = [];
  for (const id of pool) {
    const object = getObject(db, id);
    if (!object) continue;
    const concepts = listConceptsForObject(db, id);
    const houses = getHouseScores(db, id);
    const hSim = houseSimilarity(focusHouses, houses);
    const relevance = relevanceScore({
      concept: conceptSimilarity(focusConceptIds, concepts.map((c) => c.id)),
      house: hSim,
      graph: graphRelationship(focusId, id, [...focusRelations, ...listRelationsForObject(db, id)]),
      temporal: temporalProximity(focus.createdAt, object.createdAt),
      feedback: feedbackAffinity(listFeedbackForTarget(db, OBJECT_FEEDBACK_TARGET, id).map((f) => f.action)),
    });
    scored.push({
      object,
      sharedConcepts: concepts.filter((c) => focusConceptSet.has(c.id)).map((c) => c.name),
      houseSimilarity: hSim,
      relevance,
    });
  }

  scored.sort(
    (a, b) =>
      b.relevance - a.relevance ||
      b.object.createdAt.localeCompare(a.object.createdAt) ||
      a.object.id.localeCompare(b.object.id),
  );
  return scored.slice(0, MAX_RELATION_CANDIDATES);
}

/** Structured-output schema for one inference call: at most 3 proposals, targets restricted to the given candidates. */
export function relationProposalsSchema(candidateIds: readonly string[]) {
  if (candidateIds.length === 0) throw new Error("relation inference needs at least one candidate");
  return z.object({
    proposals: z
      .array(
        z.object({
          targetId: z.enum(candidateIds as [string, ...string[]]),
          type: relationTypeSchema,
          confidence: scoreSchema,
          rationale: z.string().trim().min(1),
        }),
      )
      .max(MAX_RELATION_PROPOSALS),
  });
}

function excerpt(text: string): string {
  return text.length > CANDIDATE_CONTENT_CHARS ? `${text.slice(0, CANDIDATE_CONTENT_CHARS)}...` : text;
}

/** One reasoner call. The reasoner retries malformed output at most once; this function never retries. */
export async function inferRelations(reasoner: Reasoner, input: RelationInferenceInput): Promise<RelationProposal[]> {
  const schema = relationProposalsSchema(input.candidates.map((c) => c.object.id));
  const out = await reasoner.runStructured({
    task: INFER_RELATIONS_TASK,
    system: INFER_RELATIONS_SYSTEM,
    prompt: buildInferRelationsPrompt({
      source: { id: input.source.id, type: input.source.type, title: input.source.title, content: input.source.content },
      candidates: input.candidates.map((c) => ({
        id: c.object.id,
        type: c.object.type,
        title: c.object.title,
        content: excerpt(c.object.content),
        sharedConcepts: c.sharedConcepts,
        houseSimilarity: Math.round(c.houseSimilarity * 1000) / 1000,
      })),
    }),
    schema,
  });
  return out.proposals.map((p) => ({ ...p, type: p.type as RelationType }));
}

/** Relation types that read the same in both directions. */
export const SYMMETRIC_RELATION_TYPES: ReadonlySet<RelationType> = new Set<RelationType>(["related_to", "analogous_to", "contradicts"]);

/**
 * True when a relation of the same type already links the pair: same direction for any type, and either
 * direction for symmetric types. Rejected relations count, so a declined link is not proposed again.
 */
export function duplicatesExistingRelation(
  existing: ReadonlyArray<{ sourceId: string; targetId: string; type: RelationType }>,
  sourceId: string,
  proposal: { targetId: string; type: RelationType },
): boolean {
  return existing.some(
    (r) =>
      r.type === proposal.type &&
      ((r.sourceId === sourceId && r.targetId === proposal.targetId) ||
        (SYMMETRIC_RELATION_TYPES.has(proposal.type) && r.sourceId === proposal.targetId && r.targetId === sourceId)),
  );
}

/**
 * Proposals worth persisting: confidence >= 0.55, one per (target, type) keeping the most confident,
 * ordered by confidence (ties keep the reasoner's order).
 */
export function persistableProposals(proposals: readonly RelationProposal[]): RelationProposal[] {
  const ordered = proposals
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.confidence >= MIN_RELATION_CONFIDENCE)
    .sort((a, b) => b.p.confidence - a.p.confidence || a.i - b.i)
    .map(({ p }) => p);
  const seen = new Set<string>();
  return ordered.filter((p) => {
    const key = `${p.targetId}|${p.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
