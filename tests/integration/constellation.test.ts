import { describe, expect, it } from "vitest";
import type { PcfDatabase } from "../../lib/db/database";
import { attachConcept, upsertConcept } from "../../lib/db/repositories/concepts";
import { insertObject, setHouseScores, updateObject } from "../../lib/db/repositories/objects";
import { insertRelation } from "../../lib/db/repositories/relations";
import { houseVector } from "../../lib/domain/houses";
import type { HouseNumber, HouseVector, RelationStatus } from "../../lib/domain/types";
import { CANDIDATE_POOL_LIMIT, CONSTELLATION_CENTER, MAX_CONSTELLATION_NODES, buildConstellation, constellationCandidates } from "../../lib/engine/constellation";
import { getObject } from "../../lib/db/repositories/objects";
import { SEED_OBJECTS, seedDemo } from "../../scripts/seed-demo";
import { newTestDb } from "../fixtures/capture-fixtures";

// SPEC §21: Constellation(anchor) is a projection around one object, at most 12 related nodes,
// with edges only for persisted relations between visible objects.

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
  opts: { at?: string; concepts?: string[]; vector?: HouseVector | null; activation?: number; status?: "active" | "archived" } = {},
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
    activation: opts.activation ?? 0.5,
    status: "active",
    provenance: "user",
  });
  for (const name of opts.concepts ?? []) attachConcept(db, id, upsertConcept(db, name, at).id);
  if (opts.vector !== null) setHouseScores(db, id, opts.vector ?? houses({ 2: 0.9 }));
  if (opts.status === "archived") updateObject(db, id, { status: "archived" }, at);
}

function relate(db: PcfDatabase, id: string, sourceId: string, targetId: string, status: RelationStatus = "accepted") {
  insertRelation(db, {
    id,
    sourceId,
    targetId,
    type: "related_to",
    confidence: 0.8,
    rationale: null,
    origin: "user",
    status,
    createdAt: AT,
  });
}

function anchored(): PcfDatabase {
  const db = newTestDb();
  add(db, "anchor", { concepts: ["alpha", "beta"] });
  return db;
}

const nodeIds = (db: PcfDatabase, anchorId = "anchor") => buildConstellation(db, anchorId)!.nodes.map((n) => n.object.id);

describe("constellation candidates", () => {
  it("includes concept, house-overlap, recent and directly related objects, never the anchor", () => {
    const db = anchored();
    add(db, "shares-concept", { at: day(-300), concepts: ["alpha"], vector: houses({ 11: 0.9 }) });
    add(db, "shares-house", { at: day(-200), concepts: ["zeta"], vector: houses({ 2: 0.9 }) });
    add(db, "recent", { at: day(-1), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    add(db, "related-only", { at: day(-400), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    add(db, "unrelated", { at: day(-500), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    relate(db, "r1", "anchor", "related-only");

    expect(nodeIds(db).sort()).toEqual(["recent", "related-only", "shares-concept", "shares-house"]);
  });

  it("leaves out archived objects", () => {
    const db = anchored();
    add(db, "live", { concepts: ["alpha"] });
    add(db, "archived", { concepts: ["alpha"], status: "archived" });
    expect(nodeIds(db)).toEqual(["live"]);
  });

  it("ignores a rejected relation as a reason to appear", () => {
    const db = anchored();
    add(db, "rejected-link", { at: day(-400), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    relate(db, "r1", "anchor", "rejected-link", "rejected");
    // Two newer objects, so the "two most recent" rule cannot be what keeps the rejected one in.
    add(db, "recent-1", { at: day(-1), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    add(db, "recent-2", { at: day(-2), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    expect(nodeIds(db).sort()).toEqual(["recent-1", "recent-2"]);
  });

  it("returns null for an unknown anchor", () => {
    expect(buildConstellation(newTestDb(), "missing")).toBeNull();
  });
});

describe("constellation projection", () => {
  it("keeps at most 12 related nodes (A6) even with far more candidates", () => {
    const db = anchored();
    for (let i = 0; i < 25; i++) {
      add(db, `c-${String(i).padStart(2, "0")}`, { at: day(-i), concepts: ["alpha", `topic-${i}`], vector: houses({ [((i % 12) + 1) as HouseNumber]: 0.9 }) });
    }
    const constellation = buildConstellation(db, "anchor")!;
    expect(constellation.nodes).toHaveLength(MAX_CONSTELLATION_NODES);
    expect(new Set(constellation.nodes.map((n) => n.object.id)).size).toBe(MAX_CONSTELLATION_NODES);
    expect(constellation.anchor.id).toBe("anchor");
    expect(constellation.nodes.map((n) => n.object.id)).not.toContain("anchor");
  });

  it("produces identical output on repeated builds", () => {
    const db = anchored();
    for (let i = 0; i < 15; i++) {
      add(db, `c-${i}`, { at: day(-i), concepts: ["alpha", `topic-${i % 4}`], vector: houses({ [((i % 12) + 1) as HouseNumber]: 0.9 }), activation: i / 20 });
    }
    expect(JSON.stringify(buildConstellation(db, "anchor"))).toBe(JSON.stringify(buildConstellation(db, "anchor")));
  });

  it("places each node in its dominant house, with the §21 tie going to the lowest house", () => {
    const db = anchored();
    add(db, "peak-7", { concepts: ["alpha"], vector: houses({ 7: 0.9, 2: 0.4 }) });
    add(db, "tied", { concepts: ["alpha"], vector: houses({ 4: 0.6, 9: 0.6 }) });
    const nodes = buildConstellation(db, "anchor")!.nodes;
    expect(nodes.find((n) => n.object.id === "peak-7")!.dominantHouse).toBe(7);
    expect(nodes.find((n) => n.object.id === "tied")!.dominantHouse).toBe(4);
  });

  it("puts more relevant nodes closer to the centre", () => {
    const db = anchored();
    add(db, "close", { concepts: ["alpha", "beta"] });
    add(db, "far", { at: day(-200), concepts: ["alpha"], vector: houses({ 2: 0.5, 11: 0.9 }) });
    const nodes = buildConstellation(db, "anchor")!.nodes;
    const distance = (id: string) => {
      const n = nodes.find((x) => x.object.id === id)!;
      return Math.hypot(n.x - CONSTELLATION_CENTER, n.y - CONSTELLATION_CENTER);
    };
    expect(nodes.find((n) => n.object.id === "close")!.relevance).toBeGreaterThan(nodes.find((n) => n.object.id === "far")!.relevance);
    expect(distance("close")).toBeLessThan(distance("far"));
  });
});

describe("constellation placement", () => {
  it("keeps every node's centre clear of its neighbours, on the §35 seed", () => {
    // Within one 30° sector the ±10° cap cannot always keep circles apart, but each node must stay
    // separately visible and clickable: no neighbour may cover another node's centre (SPEC §21, §25G).
    const db = newTestDb();
    seedDemo(db);
    for (const anchorId of SEED_OBJECTS.map((o) => o.id)) {
      const { nodes } = buildConstellation(db, anchorId)!;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const gap = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          const covering = Math.max(nodes[i].radius, nodes[j].radius);
          expect(gap, `${anchorId}: ${nodes[i].object.id} and ${nodes[j].object.id} sit on top of each other`).toBeGreaterThan(covering);
        }
      }
    }
  });

  it("leaves out objects that have no house vector yet", () => {
    const db = anchored();
    add(db, "classified", { concepts: ["alpha"] });
    add(db, "unclassified", { concepts: ["alpha"], vector: null });
    expect(getObject(db, "unclassified")).not.toBeNull();
    expect(nodeIds(db)).toEqual(["classified"]);
  });

  it("bounds the candidate pool so one projection cannot scan the whole store", () => {
    const db = anchored();
    for (let i = 0; i < CANDIDATE_POOL_LIMIT + 40; i++) {
      add(db, `c-${String(i).padStart(4, "0")}`, { at: day(-i), concepts: ["alpha"] });
    }
    const candidates = constellationCandidates(db, getObject(db, "anchor")!);
    expect(candidates.length).toBeLessThanOrEqual(CANDIDATE_POOL_LIMIT + 2);
    // The newest objects are the ones kept.
    expect(candidates.map((c) => c.object.id)).toContain("c-0000");
    expect(candidates.map((c) => c.object.id)).not.toContain(`c-${String(CANDIDATE_POOL_LIMIT + 39).padStart(4, "0")}`);
    expect(buildConstellation(db, "anchor")!.nodes).toHaveLength(MAX_CONSTELLATION_NODES);
  });
});

describe("constellation edges", () => {
  it("draws only persisted relations between visible objects, once each", () => {
    const db = anchored();
    add(db, "a", { concepts: ["alpha"] });
    add(db, "b", { concepts: ["alpha"] });
    add(db, "offscreen", { at: day(-900), concepts: ["zeta"], vector: houses({ 11: 0.9 }) });
    relate(db, "r1", "anchor", "a");
    relate(db, "r2", "a", "b", "proposed");
    relate(db, "r3", "b", "offscreen");

    const { nodes, edges } = buildConstellation(db, "anchor")!;
    expect(nodes.map((n) => n.object.id).sort()).toEqual(["a", "b"]);
    expect(edges).toEqual([
      { sourceId: "anchor", targetId: "a", relationType: "related_to", confidence: 0.8 },
      { sourceId: "a", targetId: "b", relationType: "related_to", confidence: 0.8 },
    ]);
  });

  it("never draws a rejected relation", () => {
    const db = anchored();
    add(db, "a", { concepts: ["alpha"] });
    relate(db, "r1", "anchor", "a", "rejected");
    expect(buildConstellation(db, "anchor")!.edges).toEqual([]);
  });

  it("draws no edges when objects merely sit near each other", () => {
    const db = anchored();
    add(db, "a", { concepts: ["alpha"] });
    add(db, "b", { concepts: ["alpha"] });
    expect(buildConstellation(db, "anchor")!.edges).toEqual([]);
  });
});
