import { HOUSE_NUMBERS } from "../domain/houses";
import type { FeedbackAction, HouseVector, Relation } from "../domain/types";
import { clamp01, cosineSimilarity, jaccard } from "../utils/math";

// SPEC.md §19 — deterministic v0.1 relevance of candidate c relative to focus f:
//   R(c,f) = 0.35C + 0.25H + 0.20G + 0.10T + 0.10F, every component in [0,1].
// Phase 3 uses it only to rank relation candidates (§17). MMR and constellation layout are Phase 4.

export const RELEVANCE_WEIGHTS = { concept: 0.35, house: 0.25, graph: 0.2, temporal: 0.1, feedback: 0.1 } as const;
export const TEMPORAL_SCALE_DAYS = 45;
const DAY_MS = 86_400_000;

export interface RelevanceComponents {
  concept: number;
  house: number;
  graph: number;
  temporal: number;
  feedback: number;
}

/** C — Jaccard similarity of concept sets. */
export function conceptSimilarity(focusConceptIds: readonly string[], candidateConceptIds: readonly string[]): number {
  return jaccard(focusConceptIds, candidateConceptIds);
}

/** H — cosine similarity of 12-dimensional house vectors; 0 if either is missing. */
export function houseSimilarity(a: HouseVector | null, b: HouseVector | null): number {
  if (!a || !b) return 0;
  return cosineSimilarity(
    HOUSE_NUMBERS.map((n) => a[n]),
    HOUSE_NUMBERS.map((n) => b[n]),
  );
}

/**
 * G — graph relationship.
 * A direct (non-rejected) relation scores 1.0 × confidence if accepted and 0.75 × confidence if proposed;
 * with several direct relations the highest counts. Without a direct relation, a two-hop path scores 0.40.
 */
export function graphRelationship(focusId: string, candidateId: string, relations: readonly Relation[]): number {
  const live = relations.filter((r) => r.status !== "rejected");
  let direct = -1;
  for (const r of live) {
    const connects = (r.sourceId === focusId && r.targetId === candidateId) || (r.sourceId === candidateId && r.targetId === focusId);
    if (!connects) continue;
    const score = r.status === "accepted" ? r.confidence : 0.75 * r.confidence;
    direct = Math.max(direct, score);
  }
  if (direct >= 0) return clamp01(direct);

  const neighbours = (id: string) => {
    const out = new Set<string>();
    for (const r of live) {
      if (r.sourceId === id) out.add(r.targetId);
      if (r.targetId === id) out.add(r.sourceId);
    }
    out.delete(focusId);
    out.delete(candidateId);
    return out;
  };
  const fromFocus = neighbours(focusId);
  for (const x of neighbours(candidateId)) if (fromFocus.has(x)) return 0.4;
  return 0;
}

/** T — exp(-d / 45) where d is the absolute number of days between creation timestamps. */
export function temporalProximity(focusCreatedAt: string, candidateCreatedAt: string): number {
  const days = Math.abs(Date.parse(focusCreatedAt) - Date.parse(candidateCreatedAt)) / DAY_MS;
  return clamp01(Math.exp(-days / TEMPORAL_SCALE_DAYS));
}

const FEEDBACK_AFFINITY: Partial<Record<FeedbackAction, number>> = {
  useful: 1.0,
  saved: 1.0,
  opened: 0.7,
  dismissed: 0.2,
  not_useful: 0.0,
};
const NO_FEEDBACK_AFFINITY = 0.5;

/**
 * F — affinity from the most recent meaningful feedback (actions listed chronologically).
 * `acted_on` has no value in §19, so it is not treated as meaningful here.
 */
export function feedbackAffinity(actionsChronological: readonly FeedbackAction[]): number {
  for (let i = actionsChronological.length - 1; i >= 0; i--) {
    const value = FEEDBACK_AFFINITY[actionsChronological[i]];
    if (value !== undefined) return value;
  }
  return NO_FEEDBACK_AFFINITY;
}

export function relevanceScore(c: RelevanceComponents): number {
  const w = RELEVANCE_WEIGHTS;
  return clamp01(w.concept * c.concept + w.house * c.house + w.graph * c.graph + w.temporal * c.temporal + w.feedback * c.feedback);
}
