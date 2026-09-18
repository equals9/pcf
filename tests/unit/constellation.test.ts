import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSTELLATION_CENTER,
  MAX_CONSTELLATION_NODES,
  MAX_JITTER_DEGREES,
  MIN_ORBIT_RADIUS,
  MMR_REDUNDANCY_WEIGHT,
  MMR_RELEVANCE_WEIGHT,
  NODE_RADIUS_BASE,
  NODE_RADIUS_PER_ACTIVATION,
  ORBIT_RADIUS_SPAN,
  REDUNDANCY_CONCEPT_WEIGHT,
  REDUNDANCY_HOUSE_WEIGHT,
  houseSectorAngle,
  jitterDegrees,
  nodeGeometry,
  sectorOrder,
  redundancySimilarity,
  selectByMmr,
  stableUnitHash,
  type ConstellationCandidate,
} from "../../lib/engine/constellation";
import { houseVector } from "../../lib/domain/houses";
import type { CognitiveObject, HouseNumber, HouseVector } from "../../lib/domain/types";

// SPEC.md §20 (MMR) and §21 (constellation geometry). SPEC §31 requires: near-duplicates must not consume
// all top positions, and identical inputs must give identical coordinates.

function object(id: string, overrides: Partial<CognitiveObject> = {}): CognitiveObject {
  return {
    id,
    type: "thought",
    content: `content of ${id}`,
    title: null,
    createdAt: "2026-09-17T12:00:00.000Z",
    updatedAt: "2026-09-17T12:00:00.000Z",
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
    ...overrides,
  };
}

function houses(peaks: Partial<Record<HouseNumber, number>>): HouseVector {
  const v = houseVector(0.05);
  for (const [k, s] of Object.entries(peaks)) v[Number(k) as HouseNumber] = s as number;
  return v;
}

function candidate(id: string, relevance: number, conceptIds: string[], peaks: Partial<Record<HouseNumber, number>>, overrides: Partial<CognitiveObject> = {}): ConstellationCandidate {
  return { object: object(id, overrides), conceptIds, houses: houses(peaks), relevance };
}

describe("§20 redundancy similarity", () => {
  it("is 0.60 concept similarity plus 0.40 house cosine similarity", () => {
    const a = candidate("a", 0.5, ["c1", "c2"], { 5: 0.9 });
    const b = candidate("b", 0.5, ["c1", "c3"], { 5: 0.9 });
    // Concepts: |{c1}| / |{c1,c2,c3}| = 1/3. Houses: identical vectors, so cosine 1.
    expect(redundancySimilarity(a, b)).toBeCloseTo(0.6 * (1 / 3) + 0.4 * 1, 12);
    expect(redundancySimilarity(a, a)).toBeCloseTo(1, 12);
  });

  it("treats a candidate without house scores as no house similarity", () => {
    const a = candidate("a", 0.5, ["c1"], { 5: 0.9 });
    const b = { ...candidate("b", 0.5, ["c1"], { 5: 0.9 }), houses: null };
    expect(redundancySimilarity(a, b)).toBeCloseTo(0.6, 12);
  });
});

describe("§20 MMR selection", () => {
  it("uses the frozen weights and cap", () => {
    expect(MMR_RELEVANCE_WEIGHT).toBe(0.78);
    expect(MMR_REDUNDANCY_WEIGHT).toBe(0.22);
    expect(REDUNDANCY_CONCEPT_WEIGHT).toBe(0.6);
    expect(REDUNDANCY_HOUSE_WEIGHT).toBe(0.4);
    expect(MAX_CONSTELLATION_NODES).toBe(12);
    expect(MAX_JITTER_DEGREES).toBe(10);
    expect(MIN_ORBIT_RADIUS).toBe(90);
    expect(ORBIT_RADIUS_SPAN).toBe(110);
    expect(NODE_RADIUS_BASE).toBe(8);
    expect(NODE_RADIUS_PER_ACTIVATION).toBe(8);
  });

  it("does not let three near-duplicates take every top position when a diverse candidate is comparable", () => {
    // Three near-identical candidates, slightly more relevant than one clearly different candidate.
    const duplicates = [
      candidate("dup-1", 0.8, ["memory", "weights"], { 2: 0.9, 8: 0.6 }),
      candidate("dup-2", 0.79, ["memory", "weights"], { 2: 0.9, 8: 0.6 }),
      candidate("dup-3", 0.78, ["memory", "weights"], { 2: 0.9, 8: 0.6 }),
    ];
    const diverse = candidate("diverse", 0.72, ["gardening"], { 11: 0.9 });

    const byRelevance = [...duplicates, diverse].sort((a, b) => b.relevance - a.relevance).map((c) => c.object.id);
    expect(byRelevance).toEqual(["dup-1", "dup-2", "dup-3", "diverse"]);

    const selected = selectByMmr([...duplicates, diverse], 3).map((c) => c.object.id);
    expect(selected).toContain("diverse");
    expect(selected.indexOf("diverse")).toBeLessThan(2);
    expect(selected).not.toContain("dup-3");
  });

  it("still takes the most relevant candidate first", () => {
    const selected = selectByMmr(
      [candidate("low", 0.2, ["x"], { 1: 0.9 }), candidate("high", 0.9, ["y"], { 2: 0.9 })],
      2,
    );
    expect(selected[0].object.id).toBe("high");
  });

  it("keeps at most 12 nodes and never repeats one", () => {
    const many = Array.from({ length: 30 }, (_, i) => candidate(`c-${i}`, i / 30, [`concept-${i}`], { [((i % 12) + 1) as HouseNumber]: 0.9 }));
    const selected = selectByMmr(many);
    expect(selected).toHaveLength(MAX_CONSTELLATION_NODES);
    expect(new Set(selected.map((c) => c.object.id)).size).toBe(MAX_CONSTELLATION_NODES);
  });

  it("returns every candidate when there are fewer than the maximum", () => {
    expect(selectByMmr([candidate("only", 0.4, [], { 3: 0.5 })])).toHaveLength(1);
    expect(selectByMmr([])).toEqual([]);
  });

  it("does not depend on input order", () => {
    const candidates = [
      candidate("a", 0.8, ["m"], { 2: 0.9 }),
      candidate("b", 0.8, ["m"], { 2: 0.9 }),
      candidate("c", 0.6, ["n"], { 7: 0.9 }),
      candidate("d", 0.55, ["o"], { 11: 0.9 }),
    ];
    const forward = selectByMmr(candidates, 3).map((c) => c.object.id);
    const reversed = selectByMmr([...candidates].reverse(), 3).map((c) => c.object.id);
    expect(reversed).toEqual(forward);
  });
});

describe("§21 geometry", () => {
  it("places house n at -90 + (n - 1) * 30 degrees", () => {
    expect(houseSectorAngle(1)).toBe(-90);
    expect(houseSectorAngle(2)).toBe(-60);
    expect(houseSectorAngle(7)).toBe(90);
    expect(houseSectorAngle(12)).toBe(240);
    for (let n = 1 as HouseNumber; n <= 12; n = (n + 1) as HouseNumber) {
      expect(houseSectorAngle(n)).toBe(-90 + (n - 1) * 30);
    }
  });

  it("spreads the nodes of one sector evenly inside ±10 degrees", () => {
    expect(jitterDegrees(0, 1)).toBe(0);
    for (const count of [1, 2, 3, 4, 7, 12]) {
      const angles = Array.from({ length: count }, (_, rank) => jitterDegrees(rank, count));
      expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(MAX_JITTER_DEGREES);
      expect(new Set(angles).size).toBe(count);
      for (let i = 1; i < count; i++) {
        expect(angles[i] - angles[i - 1]).toBeCloseTo((2 * MAX_JITTER_DEGREES) / count, 12);
      }
    }
    // Four nodes in one house sit 5° apart, not on top of each other.
    expect([0, 1, 2, 3].map((rank) => jitterDegrees(rank, 4))).toEqual([-7.5, -2.5, 2.5, 7.5]);
  });

  it("orders a sector by a stable hash that separates ids sharing a prefix", () => {
    expect(stableUnitHash("seed-01")).toBe(stableUnitHash("seed-01"));
    expect(stableUnitHash("seed-01")).not.toBe(stableUnitHash("seed-02"));
    expect(stableUnitHash("seed-01")).toBeGreaterThanOrEqual(0);
    expect(stableUnitHash("seed-01")).toBeLessThan(1);

    // Without the avalanche step these prefixed ids collapsed into about 6% of the range.
    const hashes = Array.from({ length: 15 }, (_, i) => stableUnitHash(`seed-${String(i + 1).padStart(2, "0")}`));
    expect(Math.max(...hashes) - Math.min(...hashes)).toBeGreaterThan(0.5);

    const ids = ["seed-03", "seed-01", "seed-02"];
    expect(sectorOrder(ids)).toEqual(sectorOrder([...ids].reverse()));
    expect(sectorOrder(ids).slice().sort()).toEqual([...ids].sort());
  });

  it("uses radius = 90 + (1 - R) * 110 and node radius = 8 + activation * 8", () => {
    const near = nodeGeometry(object("near"), 1, 1);
    const far = nodeGeometry(object("far"), 1, 0);
    const distance = (g: { x: number; y: number }) => Math.hypot(g.x - CONSTELLATION_CENTER, g.y - CONSTELLATION_CENTER);
    expect(distance(near)).toBeCloseTo(MIN_ORBIT_RADIUS, 10);
    expect(distance(far)).toBeCloseTo(MIN_ORBIT_RADIUS + ORBIT_RADIUS_SPAN, 10);
    expect(nodeGeometry(object("a", { activation: 0 }), 1, 0.5).radius).toBe(NODE_RADIUS_BASE);
    expect(nodeGeometry(object("a", { activation: 1 }), 1, 0.5).radius).toBe(NODE_RADIUS_BASE + NODE_RADIUS_PER_ACTIVATION);
    expect(nodeGeometry(object("a", { activation: 0.5 }), 1, 0.5).radius).toBe(NODE_RADIUS_BASE + 0.5 * NODE_RADIUS_PER_ACTIVATION);
  });

  it("puts a node in its own house sector, within the jitter bound", () => {
    for (const house of [1, 4, 8, 12] as HouseNumber[]) {
      const g = nodeGeometry(object(`house-${house}`), house, 0.5, { rank: 3, count: 4 });
      const angle = (Math.atan2(g.y - CONSTELLATION_CENTER, g.x - CONSTELLATION_CENTER) * 180) / Math.PI;
      const delta = (((angle - houseSectorAngle(house)) % 360) + 540) % 360 - 180;
      expect(Math.abs(delta)).toBeLessThanOrEqual(MAX_JITTER_DEGREES + 1e-9);
    }
  });

  it("gives identical coordinates for identical input, on every run", () => {
    const runs = Array.from({ length: 3 }, () => nodeGeometry(object("stable-id", { activation: 0.4 }), 9, 0.62));
    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
    // Pinned so a changed formula, weight or hash cannot pass unnoticed.
    expect(runs[0].x).toBeCloseTo(101.85785178121097, 9);
    expect(runs[0].y).toBeCloseTo(281.9, 9);
    expect(runs[0].radius).toBeCloseTo(11.2, 12);

    const inSector = nodeGeometry(object("stable-id", { activation: 0.4 }), 9, 0.62, { rank: 1, count: 4 });
    expect(inSector.x).toBeCloseTo(104.84100744186165, 9);
    expect(inSector.y).toBeCloseTo(286.8160883801114, 9);
  });

  it("keeps every node inside the drawing area", () => {
    for (const house of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as HouseNumber[]) {
      const g = nodeGeometry(object(`x-${house}`, { activation: 1 }), house, 0, { rank: 0, count: 5 });
      expect(Math.hypot(g.x - CONSTELLATION_CENTER, g.y - CONSTELLATION_CENTER) + g.radius).toBeLessThanOrEqual(CONSTELLATION_CENTER + 1e-9);
    }
  });

  it("uses no randomness", () => {
    const source = readFileSync(join(__dirname, "../../lib/engine/constellation.ts"), "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now\(\)|new Date\(\)/);
  });
});
