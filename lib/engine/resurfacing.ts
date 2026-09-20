import type { PcfDatabase } from "../db/database";
import { listConceptsForObject } from "../db/repositories/concepts";
import { appendEvent, listEvents } from "../db/repositories/events";
import { listFeedbackForTarget } from "../db/repositories/feedback";
import { getHouseScores, getObject, listObjectsCreatedBetween, listResurfaceCandidates } from "../db/repositories/objects";
import { listRelationsForObject } from "../db/repositories/relations";
import type { CognitiveObject, HouseVector, Relation } from "../domain/types";
import { localDayBounds } from "../utils/time";
import { OBJECT_FEEDBACK_TARGET } from "./relation-inference";
import { conceptSimilarity, feedbackAffinity, graphRelationship, houseSimilarity, relevanceScore, temporalProximity } from "./relevance";

// SPEC.md §22 — resurfacing. Deterministic and AI-free: one old thought returns, chosen by a frozen score.
// There is no resurfacing feed, and nothing about the object itself is rewritten.

/** §22 weights. */
export const RESURFACE_WEIGHTS = { relevance: 0.45, unresolvedness: 0.25, age: 0.15, importance: 0.15 } as const;
/** §22: ageSaturation = min(daysOld / 60, 1). */
export const AGE_SATURATION_DAYS = 60;
/** §22: a candidate must not have been activated in the previous 24 hours. */
export const ACTIVATION_WINDOW_HOURS = 24;
/** Bound per candidate query: the newest, the oldest and the most important are each considered. */
export const RESURFACE_CANDIDATE_LIMIT = 100;
/** Events that mean the user touched the object. */
const ACTIVATION_EVENTS = ["OBJECT_RESURFACED", "OBJECT_OPENED", "OPERATOR_INVOKED"] as const;
/** Feedback actions that mean the user engaged with the object. */
const ACTIVATION_FEEDBACK = ["opened", "useful", "saved", "acted_on"];

/** §22 unresolvedness by object type and status. */
export function unresolvedness(object: CognitiveObject): number {
  if (object.status === "resolved") return 0;
  switch (object.type) {
    case "question":
      return 1;
    case "claim":
    case "belief":
      return 0.7;
    case "idea":
      return 0.6;
    default:
      return 0.3;
  }
}

export function ageSaturation(object: CognitiveObject, now: Date): number {
  const days = (now.getTime() - Date.parse(object.createdAt)) / 86_400_000;
  return Math.min(Math.max(days, 0) / AGE_SATURATION_DAYS, 1);
}

export interface ResurfaceScore {
  total: number;
  relevance: number;
  /** The concept, house and graph part of §19: whether the thought is genuinely close to today's thinking. */
  closeness: number;
  unresolvedness: number;
  age: number;
  importance: number;
  /** True when Today is empty, so the relevance term is omitted and the rest are renormalized (§22). */
  withoutRelevance: boolean;
}

/**
 * §22: 0.45 × max relevance to today's objects + 0.25 × unresolvedness + 0.15 × age saturation +
 * 0.15 × importance. With no objects today, the relevance term is omitted and the remaining weights are
 * renormalized so the score stays in [0, 1].
 */
export function resurfaceScore(parts: {
  relevance: number | null;
  closeness?: number;
  unresolvedness: number;
  age: number;
  importance: number;
}): ResurfaceScore {
  const { relevance, unresolvedness: unresolved, age, importance } = parts;
  const closeness = parts.closeness ?? 0;
  const weighted = RESURFACE_WEIGHTS.unresolvedness * unresolved + RESURFACE_WEIGHTS.age * age + RESURFACE_WEIGHTS.importance * importance;
  if (relevance === null) {
    const remaining = RESURFACE_WEIGHTS.unresolvedness + RESURFACE_WEIGHTS.age + RESURFACE_WEIGHTS.importance;
    return { total: weighted / remaining, relevance: 0, closeness: 0, unresolvedness: unresolved, age, importance, withoutRelevance: true };
  }
  return {
    total: RESURFACE_WEIGHTS.relevance * relevance + weighted,
    relevance,
    closeness,
    unresolvedness: unresolved,
    age,
    importance,
    withoutRelevance: false,
  };
}

export interface ResurfaceCandidate {
  object: CognitiveObject;
  score: ResurfaceScore;
  /** The object today that this one is most relevant to, if any. */
  nearestTodayId: string | null;
}

/** True when the user dismissed this thought from the Return card today (§25E). */
function dismissedToday(db: PcfDatabase, objectId: string, now: Date): boolean {
  const { start } = localDayBounds(now);
  return listFeedbackForTarget(db, OBJECT_FEEDBACK_TARGET, objectId).some(
    (feedback) => feedback.action === "dismissed" && feedback.createdAt >= start,
  );
}

/**
 * §22: activated in the previous 24 hours. Any sign that the user touched the thought counts — it was
 * returned, opened, or run through an operator — not only a previous resurfacing.
 */
function recentlyActivated(db: PcfDatabase, objectId: string, now: Date): boolean {
  const cutoff = now.getTime() - ACTIVATION_WINDOW_HOURS * 3_600_000;
  const touched = ACTIVATION_EVENTS.flatMap((type) => listEvents(db, { type, objectId })).some((event) => Date.parse(event.createdAt) >= cutoff);
  if (touched) return true;
  return listFeedbackForTarget(db, OBJECT_FEEDBACK_TARGET, objectId).some(
    (feedback) => ACTIVATION_FEEDBACK.includes(feedback.action) && Date.parse(feedback.createdAt) >= cutoff,
  );
}

interface TodayContext {
  object: CognitiveObject;
  conceptIds: string[];
  houses: HouseVector | null;
  relations: Relation[];
}

function todayContext(db: PcfDatabase, now: Date): TodayContext[] {
  const { start, end } = localDayBounds(now);
  return listObjectsCreatedBetween(db, start, end).map((object) => ({
    object,
    conceptIds: listConceptsForObject(db, object.id).map((c) => c.id),
    houses: getHouseScores(db, object.id),
    relations: listRelationsForObject(db, object.id),
  }));
}

/** Score one candidate against today's thoughts, using the frozen §19 relevance in full. */
function scoreCandidate(db: PcfDatabase, object: CognitiveObject, today: readonly TodayContext[], now: Date): ResurfaceCandidate {
  const conceptIds = listConceptsForObject(db, object.id).map((c) => c.id);
  const houses = getHouseScores(db, object.id);
  const relations = listRelationsForObject(db, object.id);
  const feedback = feedbackAffinity(listFeedbackForTarget(db, OBJECT_FEEDBACK_TARGET, object.id).map((f) => f.action));

  let relevance: number | null = null;
  let closeness = 0;
  let nearestTodayId: string | null = null;
  for (const todayObject of today) {
    const concept = conceptSimilarity(todayObject.conceptIds, conceptIds);
    const house = houseSimilarity(todayObject.houses, houses);
    const graph = graphRelationship(todayObject.object.id, object.id, [...todayObject.relations, ...relations]);
    const score = relevanceScore({
      concept,
      house,
      graph,
      temporal: temporalProximity(todayObject.object.createdAt, object.createdAt),
      feedback,
    });
    if (relevance === null || score > relevance) {
      relevance = score;
      // Shared concepts, houses or links are what "close to today" means. Time and feedback alone are not
      // closeness, and would otherwise make every old thought look related to today's thinking.
      closeness = concept + house + graph;
      nearestTodayId = todayObject.object.id;
    }
  }

  return {
    object,
    score: resurfaceScore({
      relevance,
      closeness,
      unresolvedness: unresolvedness(object),
      age: ageSaturation(object, now),
      importance: object.importance,
    }),
    nearestTodayId,
  };
}

/**
 * §22 candidates: created before today, not archived, not activated in the previous 24 hours, and not
 * dismissed today. Bounded by three queries (newest, oldest, most important), so the work per render stays
 * flat while a very old or very important thought can still win.
 */
export function resurfaceCandidates(db: PcfDatabase, now: Date = new Date()): ResurfaceCandidate[] {
  const { start } = localDayBounds(now);
  const today = todayContext(db, now);
  return listResurfaceCandidates(db, start, RESURFACE_CANDIDATE_LIMIT)
    .filter((object) => !recentlyActivated(db, object.id, now) && !dismissedToday(db, object.id, now))
    .map((object) => scoreCandidate(db, object, today, now));
}

/** The single object to bring back, or null. Ties go to the older thought, then the lower id. */
export function selectResurfaced(candidates: readonly ResurfaceCandidate[]): ResurfaceCandidate | null {
  let best: ResurfaceCandidate | null = null;
  for (const candidate of candidates) {
    if (
      best === null ||
      candidate.score.total > best.score.total ||
      (candidate.score.total === best.score.total &&
        (candidate.object.createdAt < best.object.createdAt ||
          (candidate.object.createdAt === best.object.createdAt && candidate.object.id < best.object.id)))
    ) {
      best = candidate;
    }
  }
  return best;
}

/**
 * §25E "Why this returned": derived from the score, never generated, and saying only what the score actually
 * measured. Importance comes from extraction and age from the capture date, so neither is described as
 * something the user did.
 */
export function whyReturned(candidate: ResurfaceCandidate, nearestTitle: string | null): string {
  const { score } = candidate;
  const reasons: Array<{ weight: number; text: string }> = [];
  if (!score.withoutRelevance && score.closeness > 0) {
    reasons.push({
      weight: RESURFACE_WEIGHTS.relevance * score.relevance,
      text: nearestTitle ? `It shares ground with what you captured today: ${nearestTitle}` : "It shares ground with what you captured today",
    });
  }
  if (score.unresolvedness >= 0.6) {
    reasons.push({
      weight: RESURFACE_WEIGHTS.unresolvedness * score.unresolvedness,
      text: candidate.object.type === "question" ? "It is still an open question" : "It is still unresolved",
    });
  }
  if (score.age >= 0.5) {
    reasons.push({ weight: RESURFACE_WEIGHTS.age * score.age, text: "You wrote it a long time ago" });
  }
  if (score.importance >= 0.6) {
    reasons.push({ weight: RESURFACE_WEIGHTS.importance * score.importance, text: "It read as important when you captured it" });
  }
  if (reasons.length === 0) return "It has been quiet for a while.";
  return `${reasons.sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text))[0].text}.`;
}

export interface Resurfaced {
  object: CognitiveObject;
  why: string;
  ageDays: number;
  score: number;
}

/** The object already returned today, if there is one. §22 shows one per day, not a new one per reload. */
function alreadyReturnedToday(db: PcfDatabase, now: Date): string | null {
  const { start } = localDayBounds(now);
  const today = listEvents(db, { type: "OBJECT_RESURFACED" }).filter((event) => event.createdAt >= start && event.objectId !== null);
  return today.length > 0 ? (today[today.length - 1].objectId as string) : null;
}

/**
 * §22: choose at most one object to return, and record OBJECT_RESURFACED the first time it is shown on a
 * given day. A reload shows the same thought, scored the same way, and writes nothing. Nothing about the
 * object is modified. Returns null when nothing qualifies.
 */
export function resurfaceForToday(db: PcfDatabase, now: Date = new Date()): Resurfaced | null {
  const view = (candidate: ResurfaceCandidate): Resurfaced => ({
    object: candidate.object,
    why: whyReturned(candidate, candidate.nearestTodayId ? (getObject(db, candidate.nearestTodayId)?.title ?? null) : null),
    ageDays: Math.floor((now.getTime() - Date.parse(candidate.object.createdAt)) / 86_400_000),
    score: candidate.score.total,
  });

  const alreadyId = alreadyReturnedToday(db, now);
  if (alreadyId && !dismissedToday(db, alreadyId, now)) {
    const object = getObject(db, alreadyId);
    if (!object || object.status === "archived") return null;
    // Scored exactly as when it was chosen, so the card reads the same on every reload that day.
    return view(scoreCandidate(db, object, todayContext(db, now), now));
  }

  const chosen = selectResurfaced(resurfaceCandidates(db, now));
  if (!chosen) return null;

  appendEvent(db, {
    type: "OBJECT_RESURFACED",
    objectId: chosen.object.id,
    payload: { score: chosen.score.total, relatedTodayId: chosen.nearestTodayId },
    createdAt: now.toISOString(),
  });
  return view(chosen);
}
