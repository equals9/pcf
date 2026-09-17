/**
 * SPEC.md §35 — deterministic synthetic seed. No private user data.
 * ~15 cognitive objects across AI memory, retrieval, knowledge graphs, creativity, search,
 * human cognition, evidence, and belief change. Includes two related claims, one deliberate
 * contradiction, one old unresolved question, and several cross-house ideas.
 *
 * All IDs and content are fixed; timestamps are offsets from `now` so ages stay meaningful.
 */
import { pathToFileURL } from "node:url";
import { openDatabase, type PcfDatabase } from "../lib/db/database";
import { runMigrations } from "../lib/db/migrations";
import { insertClaim } from "../lib/db/repositories/claims";
import { attachConcept, upsertConcept } from "../lib/db/repositories/concepts";
import { appendEvent } from "../lib/db/repositories/events";
import { getObject, insertObject, setHouseScores } from "../lib/db/repositories/objects";
import { insertRelation } from "../lib/db/repositories/relations";
import { houseVector } from "../lib/domain/houses";
import type { Claim, CognitiveObject, HouseNumber, HouseVector, Relation } from "../lib/domain/types";
import { daysAgoIso } from "../lib/utils/time";

type SeedObject = {
  id: string;
  type: CognitiveObject["type"];
  title: string;
  content: string;
  daysOld: number;
  importance: number;
  status?: CognitiveObject["status"];
  houses: Partial<Record<HouseNumber, number>>;
  concepts: string[];
  claim?: Omit<Claim, "id" | "objectId" | "validFrom" | "validTo">;
};

function hv(peaks: Partial<Record<HouseNumber, number>>): HouseVector {
  const v = houseVector(0.05);
  for (const [k, s] of Object.entries(peaks)) v[Number(k) as HouseNumber] = s as number;
  return v;
}

export const SEED_OBJECTS: SeedObject[] = [
  {
    id: "seed-01", type: "claim", daysOld: 40, importance: 0.7,
    title: "Personal AI memory belongs in model weights",
    content: "Personal AI memory should live inside model weights. Fine-tuning on a person's history is the only way the model truly internalizes them.",
    houses: { 2: 0.7, 8: 0.6, 9: 0.4 },
    concepts: ["AI memory", "model weights", "fine-tuning"],
    claim: { normalizedClaim: "personal AI memory should live inside model weights", subject: "personal AI memory", predicate: "should live inside", objectText: "model weights", polarity: "positive", scope: null, confidence: 0.7 },
  },
  {
    id: "seed-02", type: "claim", daysOld: 10, importance: 0.85,
    title: "Personal AI memory belongs outside model weights",
    content: "Personal AI memory should remain outside model weights. Memory that is owned, inspectable, and portable has to live in a store the person controls.",
    houses: { 2: 0.8, 4: 0.6, 8: 0.5 },
    concepts: ["AI memory", "model weights", "user-owned memory"],
    claim: { normalizedClaim: "personal AI memory should remain outside model weights", subject: "personal AI memory", predicate: "should remain outside", objectText: "model weights", polarity: "negative", scope: null, confidence: 0.85 },
  },
  {
    id: "seed-03", type: "claim", daysOld: 8, importance: 0.75,
    title: "Retrieval quality beats model size for memory",
    content: "For personal memory, retrieval quality matters more than model size. A small model with the right context outperforms a large one guessing.",
    houses: { 2: 0.6, 6: 0.7, 9: 0.4 },
    concepts: ["retrieval", "AI memory", "context"],
    claim: { normalizedClaim: "retrieval quality matters more than model size for personal memory", subject: "retrieval quality", predicate: "matters more than", objectText: "model size", polarity: "positive", scope: "personal memory", confidence: 0.75 },
  },
  {
    id: "seed-04", type: "question", daysOld: 120, importance: 0.8,
    title: "Should AI memory imitate human forgetting?",
    content: "Is forgetting a feature of human memory that AI memory should deliberately imitate, or a limitation to engineer away?",
    houses: { 8: 0.7, 9: 0.7, 12: 0.6 },
    concepts: ["forgetting", "human cognition", "AI memory"],
  },
  {
    id: "seed-05", type: "idea", daysOld: 30, importance: 0.65,
    title: "Memory as state-transition history",
    content: "Maybe memory is reconstructable state-transition history: store the events, not the summaries, and rebuild any past state on demand.",
    houses: { 4: 0.7, 5: 0.7, 8: 0.6 },
    concepts: ["AI memory", "event history", "reconstruction"],
  },
  {
    id: "seed-06", type: "idea", daysOld: 25, importance: 0.6,
    title: "Knowledge graphs as scaffolding, not storage",
    content: "A knowledge graph should be scaffolding that helps find things, not the canonical place things live. Raw text stays canonical; the graph is a projection.",
    houses: { 4: 0.6, 6: 0.6, 9: 0.5 },
    concepts: ["knowledge graphs", "retrieval", "projection"],
  },
  {
    id: "seed-07", type: "evidence", daysOld: 20, importance: 0.55,
    title: "Search engines rank by many signals, not one",
    content: "Production search combines lexical match, freshness, click feedback, and link structure. No single similarity score wins alone.",
    houses: { 6: 0.8, 2: 0.4, 11: 0.4 },
    concepts: ["search", "ranking", "retrieval"],
  },
  {
    id: "seed-08", type: "belief", daysOld: 60, importance: 0.7,
    title: "Creativity is mostly recombination",
    content: "I believe most creative insight is recombination of things already known, triggered by an unexpected adjacency.",
    houses: { 5: 0.9, 9: 0.5, 12: 0.4 },
    concepts: ["creativity", "recombination", "adjacency"],
    claim: { normalizedClaim: "most creative insight is recombination of known material", subject: "creative insight", predicate: "is mostly", objectText: "recombination", polarity: "positive", scope: null, confidence: 0.65 },
  },
  {
    id: "seed-09", type: "thought", daysOld: 15, importance: 0.5,
    title: "Similar is not the same as relevant",
    content: "Five near-identical memories are worse than three complementary ones. Similarity search alone produces echo, not thought.",
    houses: { 5: 0.5, 6: 0.6, 7: 0.5 },
    concepts: ["retrieval", "diversity", "relevance"],
  },
  {
    id: "seed-10", type: "evidence", daysOld: 45, importance: 0.6,
    title: "Spacing effect in human recall",
    content: "Spaced re-exposure improves long-term human recall compared with massed repetition. Resurfacing at intervals is a real memory operation.",
    houses: { 3: 0.6, 6: 0.5, 9: 0.5 },
    concepts: ["human cognition", "spacing effect", "resurfacing"],
  },
  {
    id: "seed-11", type: "idea", daysOld: 12, importance: 0.7,
    title: "Contradictions as the most valuable retrieval",
    content: "The most useful thing a memory system can return is not agreement but a prior claim that conflicts with what I am saying now.",
    houses: { 7: 0.8, 8: 0.6, 9: 0.5 },
    concepts: ["contradiction", "belief change", "retrieval"],
  },
  {
    id: "seed-12", type: "belief", daysOld: 90, importance: 0.6,
    title: "Beliefs should carry their own history",
    content: "A belief without its revision history is just an assertion. Belief change is data, and the system should keep every prior version.",
    houses: { 4: 0.6, 8: 0.5, 9: 0.7 },
    concepts: ["belief change", "event history", "epistemic state"],
  },
  {
    id: "seed-13", type: "decision", daysOld: 5, importance: 0.65,
    title: "Use deterministic relevance before learning any model",
    content: "Decided: relevance scoring stays deterministic and inspectable until there is enough feedback to learn from. No learned ranker yet.",
    houses: { 6: 0.7, 10: 0.6, 1: 0.4 },
    concepts: ["relevance", "ranking", "feedback"],
  },
  {
    id: "seed-14", type: "experiment", daysOld: 3, importance: 0.6,
    title: "Test whether resurfaced thoughts change what I write next",
    content: "Experiment: for two weeks, log whether a resurfaced old thought led to a new capture within the hour. Success if it happens in at least one of five sessions.",
    houses: { 3: 0.7, 6: 0.5, 10: 0.5 },
    concepts: ["resurfacing", "experiment", "feedback"],
  },
  {
    id: "seed-15", type: "question", daysOld: 2, importance: 0.55,
    title: "Can a graph over thoughts help more than a backlink list?",
    content: "Does a contextual constellation actually orient thinking better than a flat list of backlinks, or is it just prettier?",
    houses: { 5: 0.5, 7: 0.5, 11: 0.5 },
    concepts: ["knowledge graphs", "constellation", "orientation"],
  },
];

type SeedRelation = Omit<Relation, "createdAt"> & { daysOld: number };

export const SEED_RELATIONS: SeedRelation[] = [
  { id: "seed-rel-01", sourceId: "seed-01", targetId: "seed-02", type: "contradicts", confidence: 0.9, rationale: "Opposite positions on where personal memory should live.", origin: "user", status: "accepted", daysOld: 10 },
  { id: "seed-rel-02", sourceId: "seed-03", targetId: "seed-02", type: "supports", confidence: 0.8, rationale: "External retrieval only matters if memory is outside weights.", origin: "user", status: "accepted", daysOld: 8 },
  { id: "seed-rel-03", sourceId: "seed-05", targetId: "seed-12", type: "supports", confidence: 0.7, rationale: "Event history enables belief revision history.", origin: "ai_inferred", status: "proposed", daysOld: 30 },
  { id: "seed-rel-04", sourceId: "seed-09", targetId: "seed-07", type: "derived_from", confidence: 0.6, rationale: "Multi-signal ranking implies similarity alone is insufficient.", origin: "ai_inferred", status: "proposed", daysOld: 15 },
  { id: "seed-rel-05", sourceId: "seed-11", targetId: "seed-04", type: "questions", confidence: 0.6, rationale: "Contradiction retrieval reopens whether forgetting is desirable.", origin: "ai_inferred", status: "proposed", daysOld: 12 },
  { id: "seed-rel-06", sourceId: "seed-14", targetId: "seed-10", type: "depends_on", confidence: 0.75, rationale: "The experiment tests the spacing effect in this tool.", origin: "user", status: "accepted", daysOld: 3 },
  { id: "seed-rel-07", sourceId: "seed-13", targetId: "seed-09", type: "extends", confidence: 0.65, rationale: "Deterministic relevance operationalizes diversity over similarity.", origin: "ai_inferred", status: "proposed", daysOld: 5 },
  { id: "seed-rel-08", sourceId: "seed-15", targetId: "seed-06", type: "related_to", confidence: 0.6, rationale: "Both concern graphs as projections for orientation.", origin: "ai_inferred", status: "proposed", daysOld: 2 },
];

export interface SeedSummary {
  objects: number;
  concepts: number;
  claims: number;
  relations: number;
  events: number;
}

/** Idempotent: if seed-01 already exists, nothing is written. */
export function seedDemo(db: PcfDatabase, now: Date = new Date()): SeedSummary | null {
  if (getObject(db, SEED_OBJECTS[0].id)) return null;

  const conceptIds = new Set<string>();
  let claims = 0;
  let events = 0;

  db.transaction(() => {
    for (const s of SEED_OBJECTS) {
      const createdAt = daysAgoIso(s.daysOld, now);
      insertObject(db, {
        id: s.id,
        type: s.type,
        content: s.content,
        title: s.title,
        createdAt,
        updatedAt: createdAt,
        lastActivatedAt: createdAt,
        importance: s.importance,
        activation: 0.5,
        status: s.status ?? "active",
        provenance: "user",
      });
      appendEvent(db, { id: `${s.id}-ev-captured`, type: "OBJECT_CAPTURED", objectId: s.id, payload: {}, createdAt });
      events++;

      for (const name of s.concepts) {
        const c = upsertConcept(db, name, createdAt, `seed-concept-${name.toLowerCase().replace(/\s+/g, "-")}`);
        conceptIds.add(c.id);
        attachConcept(db, s.id, c.id);
      }
      if (s.claim) {
        insertClaim(db, { ...s.claim, id: `${s.id}-claim`, objectId: s.id, validFrom: createdAt, validTo: null }, createdAt);
        claims++;
      }
      appendEvent(db, { id: `${s.id}-ev-extracted`, type: "OBJECT_EXTRACTED", objectId: s.id, payload: { type: s.type, concepts: s.concepts.length, claims: s.claim ? 1 : 0 }, createdAt });
      events++;

      setHouseScores(db, s.id, hv(s.houses));
      appendEvent(db, { id: `${s.id}-ev-houses`, type: "HOUSE_CLASSIFIED", objectId: s.id, payload: { houses: s.houses }, createdAt });
      events++;
    }

    for (const r of SEED_RELATIONS) {
      const createdAt = daysAgoIso(r.daysOld, now);
      const { daysOld: _d, ...rel } = r;
      insertRelation(db, { ...rel, createdAt });
      appendEvent(db, { id: `${r.id}-ev-proposed`, type: "RELATION_PROPOSED", objectId: r.sourceId, payload: { relationId: r.id, targetId: r.targetId, type: r.type }, createdAt });
      events++;
      if (r.status === "accepted") {
        appendEvent(db, { id: `${r.id}-ev-accepted`, type: "RELATION_ACCEPTED", objectId: r.sourceId, payload: { relationId: r.id }, createdAt });
        events++;
      }
    }
  })();

  return { objects: SEED_OBJECTS.length, concepts: conceptIds.size, claims, relations: SEED_RELATIONS.length, events };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDatabase();
  runMigrations(db);
  const summary = seedDemo(db);
  db.close();
  console.log(summary ? `seeded: ${JSON.stringify(summary)}` : "already seeded: nothing written");
}
