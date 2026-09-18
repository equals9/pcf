import type { PcfDatabase } from "../db/database";
import { listConceptsForObject, listRecentObjectIdsSharingConcepts } from "../db/repositories/concepts";
import { listFeedbackForTarget } from "../db/repositories/feedback";
import { getHouseScores, getObject, listRecentObjectIds, listRecentObjectIdsWithHouseScoreAtLeast } from "../db/repositories/objects";
import { listRelationsForObject } from "../db/repositories/relations";
import { dominantHouse } from "../domain/houses";
import type { CognitiveObject, ConstellationEdge, ConstellationNode, HouseNumber, HouseVector, Relation } from "../domain/types";
import { cosineSimilarity, jaccard } from "../utils/math";
import { DOMINANT_HOUSE_MIN_SCORE, housesAtOrAbove } from "./house-classifier";
import { OBJECT_FEEDBACK_TARGET, RECENT_CANDIDATES } from "./relation-inference";
import { conceptSimilarity, feedbackAffinity, graphRelationship, houseSimilarity, relevanceScore, temporalProximity } from "./relevance";

// SPEC.md §20 (diversity reranking) and §21 (constellation algorithm). Everything here is deterministic:
// no randomness, no physics, no persisted positions. Identical inputs give identical output.

/** §21: at most 12 related nodes plus the anchor. */
export const MAX_CONSTELLATION_NODES = 12;

/** §20: MMR(c) = 0.78 * relevance(c) - 0.22 * maxSimilarity(c, selected). */
export const MMR_RELEVANCE_WEIGHT = 0.78;
export const MMR_REDUNDANCY_WEIGHT = 0.22;
/** §20: redundancy similarity = 0.60 concept similarity + 0.40 house cosine similarity. */
export const REDUNDANCY_CONCEPT_WEIGHT = 0.6;
export const REDUNDANCY_HOUSE_WEIGHT = 0.4;

/**
 * How many objects each unbounded arm of the candidate pool may contribute, newest first. The pool only has
 * to be large enough for MMR to have real choice; scoring every object in the store would make the Today
 * render grow with the whole corpus (SPEC §38).
 */
export const CANDIDATE_POOL_LIMIT = 8 * MAX_CONSTELLATION_NODES;

/** §21 geometry, frozen for v0.1. */
export const SECTOR_DEGREES = 30;
export const FIRST_SECTOR_CENTER_DEGREES = -90;
export const MAX_JITTER_DEGREES = 10;
export const MIN_ORBIT_RADIUS = 90;
export const ORBIT_RADIUS_SPAN = 110;
export const NODE_RADIUS_BASE = 8;
export const NODE_RADIUS_PER_ACTIVATION = 8;

/** Drawing space: the anchor sits at the centre, and the widest node still fits inside. */
export const CONSTELLATION_CENTER = MIN_ORBIT_RADIUS + ORBIT_RADIUS_SPAN + NODE_RADIUS_BASE + NODE_RADIUS_PER_ACTIVATION;
export const CONSTELLATION_SIZE = CONSTELLATION_CENTER * 2;

export interface Constellation {
  anchor: CognitiveObject;
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
}

/** One candidate with everything the ranking needs, read once. */
export interface ConstellationCandidate {
  object: CognitiveObject;
  conceptIds: string[];
  houses: HouseVector | null;
  relevance: number;
}

/** §20 redundancy between two candidates. Used only to spread the constellation, never to rank. */
export function redundancySimilarity(a: ConstellationCandidate, b: ConstellationCandidate): number {
  const concepts = jaccard(a.conceptIds, b.conceptIds);
  const houses = a.houses && b.houses ? cosineSimilarity(Object.values(a.houses), Object.values(b.houses)) : 0;
  return REDUNDANCY_CONCEPT_WEIGHT * concepts + REDUNDANCY_HOUSE_WEIGHT * houses;
}

/**
 * §20 MMR selection. The first pick is the most relevant candidate; each later pick maximises
 * `0.78 * relevance - 0.22 * maxSimilarity(candidate, selected)`. Ties are broken by higher relevance,
 * then the newer object, then the lower id, so the result never depends on input order.
 */
export function selectByMmr(candidates: readonly ConstellationCandidate[], max: number = MAX_CONSTELLATION_NODES): ConstellationCandidate[] {
  const remaining = [...candidates];
  const selected: ConstellationCandidate[] = [];
  const better = (a: ConstellationCandidate, b: ConstellationCandidate, scoreA: number, scoreB: number) =>
    scoreA - scoreB ||
    a.relevance - b.relevance ||
    a.object.createdAt.localeCompare(b.object.createdAt) ||
    b.object.id.localeCompare(a.object.id);

  while (remaining.length > 0 && selected.length < max) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    remaining.forEach((candidate, index) => {
      const redundancy = selected.reduce((worst, chosen) => Math.max(worst, redundancySimilarity(candidate, chosen)), 0);
      const score = MMR_RELEVANCE_WEIGHT * candidate.relevance - MMR_REDUNDANCY_WEIGHT * redundancy;
      if (index === 0 || better(candidate, remaining[bestIndex], score, bestScore) > 0) {
        bestIndex = index;
        bestScore = score;
      }
    });
    selected.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }
  return selected;
}

/** §21: house n sits at -90° + (n - 1) * 30°. */
export function houseSectorAngle(house: HouseNumber): number {
  return FIRST_SECTOR_CENTER_DEGREES + (house - 1) * SECTOR_DEGREES;
}

/**
 * FNV-1a over the id with a final avalanche step, mapped to [0, 1). Integer math only, so it is identical
 * across runs, processes and platforms. The finalizer matters: without it, ids sharing a prefix (`seed-01`,
 * `seed-02`, ...) differ only in the high bits and collapse into a sliver of the range.
 */
export function stableUnitHash(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193) >>> 0;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}

/**
 * §21 angular jitter. The nodes that share a house sector are spread evenly across the ±10° band, in a
 * stable id-hash order, so two thoughts in the same house never land on the same spot. With one node in the
 * sector it sits on the sector centre.
 */
export function jitterDegrees(rank: number, count: number): number {
  if (count <= 1) return 0;
  return MAX_JITTER_DEGREES * ((2 * (rank + 0.5)) / count - 1);
}

/** Order within a house sector: stable id hash, then id. Independent of candidate order. */
export function sectorOrder(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => stableUnitHash(a) - stableUnitHash(b) || a.localeCompare(b));
}

/** §21: radius = 90 + (1 - R) * 110, node radius = 8 + activation * 8, placed in the house sector. */
export function nodeGeometry(
  object: CognitiveObject,
  house: HouseNumber,
  relevance: number,
  sector: { rank: number; count: number } = { rank: 0, count: 1 },
): { x: number; y: number; radius: number } {
  const angle = ((houseSectorAngle(house) + jitterDegrees(sector.rank, sector.count)) * Math.PI) / 180;
  const orbit = MIN_ORBIT_RADIUS + (1 - relevance) * ORBIT_RADIUS_SPAN;
  return {
    x: CONSTELLATION_CENTER + orbit * Math.cos(angle),
    y: CONSTELLATION_CENTER + orbit * Math.sin(angle),
    radius: NODE_RADIUS_BASE + object.activation * NODE_RADIUS_PER_ACTIVATION,
  };
}

/** A relation that still stands: the user has not rejected it. */
const live = (relation: Relation) => relation.status !== "rejected";

/**
 * Candidate pool for a constellation: objects sharing a concept with the anchor, objects with significant
 * house overlap (§17), the most recent objects, and every object the anchor is directly related to. The
 * anchor and archived objects are excluded.
 */
export function constellationCandidates(db: PcfDatabase, anchor: CognitiveObject): ConstellationCandidate[] {
  const anchorConceptIds = listConceptsForObject(db, anchor.id).map((c) => c.id);
  const anchorHouses = getHouseScores(db, anchor.id);
  const anchorRelations = listRelationsForObject(db, anchor.id).filter(live);

  const pool = new Set<string>([
    ...listRecentObjectIdsSharingConcepts(db, anchor.id, CANDIDATE_POOL_LIMIT),
    ...(anchorHouses
      ? listRecentObjectIdsWithHouseScoreAtLeast(db, housesAtOrAbove(anchorHouses), DOMINANT_HOUSE_MIN_SCORE, anchor.id, CANDIDATE_POOL_LIMIT)
      : []),
    ...listRecentObjectIds(db, RECENT_CANDIDATES, anchor.id),
    ...anchorRelations.map((r) => (r.sourceId === anchor.id ? r.targetId : r.sourceId)),
  ]);
  pool.delete(anchor.id);

  const candidates: ConstellationCandidate[] = [];
  for (const id of pool) {
    const object = getObject(db, id);
    if (!object || object.status === "archived") continue;
    const houses = getHouseScores(db, id);
    // §21 places a candidate in its highest-scoring house. An object still waiting for classification has
    // none, so it stays out of the dial rather than being shown under a house it was never given.
    if (!houses) continue;
    const conceptIds = listConceptsForObject(db, id).map((c) => c.id);
    candidates.push({
      object,
      conceptIds,
      houses,
      relevance: relevanceScore({
        concept: conceptSimilarity(anchorConceptIds, conceptIds),
        house: houseSimilarity(anchorHouses, houses),
        graph: graphRelationship(anchor.id, id, [...anchorRelations, ...listRelationsForObject(db, id)]),
        temporal: temporalProximity(anchor.createdAt, object.createdAt),
        feedback: feedbackAffinity(listFeedbackForTarget(db, OBJECT_FEEDBACK_TARGET, id).map((f) => f.action)),
      }),
    });
  }
  return candidates;
}

/** §21: edges are drawn only for persisted, non-rejected relations between visible objects. */
export function constellationEdges(db: PcfDatabase, visibleIds: readonly string[]): ConstellationEdge[] {
  const visible = new Set(visibleIds);
  const seen = new Set<string>();
  const edges: ConstellationEdge[] = [];
  for (const id of visibleIds) {
    for (const relation of listRelationsForObject(db, id)) {
      if (!live(relation) || !visible.has(relation.sourceId) || !visible.has(relation.targetId) || seen.has(relation.id)) continue;
      seen.add(relation.id);
      edges.push({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.type,
        confidence: relation.confidence,
      });
    }
  }
  return edges;
}

/**
 * `Constellation(anchor)` (§21): a projection around one object, never the global graph.
 * Candidates are ranked by §19 relevance, reranked for diversity with §20 MMR, cut to 12, and placed
 * deterministically. Returns null when the anchor does not exist.
 */
export function buildConstellation(db: PcfDatabase, anchorId: string): Constellation | null {
  const anchor = getObject(db, anchorId);
  if (!anchor) return null;
  const selected = selectByMmr(constellationCandidates(db, anchor));
  const houseOf = new Map(selected.map((c) => [c.object.id, dominantHouse(c.houses as HouseVector)]));

  // Nodes that share a sector are spread across it, so no two thoughts sit on the same point.
  const ranks = new Map<string, { rank: number; count: number }>();
  for (const house of new Set(houseOf.values())) {
    const ids = sectorOrder([...houseOf.entries()].filter(([, h]) => h === house).map(([id]) => id));
    ids.forEach((id, rank) => ranks.set(id, { rank, count: ids.length }));
  }

  const nodes: ConstellationNode[] = selected.map((candidate) => {
    const house = houseOf.get(candidate.object.id) as HouseNumber;
    return {
      object: candidate.object,
      relevance: candidate.relevance,
      dominantHouse: house,
      ...nodeGeometry(candidate.object, house, candidate.relevance, ranks.get(candidate.object.id)),
    };
  });
  return { anchor, nodes, edges: constellationEdges(db, [anchor.id, ...nodes.map((n) => n.object.id)]) };
}
