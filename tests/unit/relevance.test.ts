import { describe, expect, it } from "vitest";
import { houseVector } from "../../lib/domain/houses";
import type { Relation } from "../../lib/domain/types";
import {
  conceptSimilarity,
  feedbackAffinity,
  graphRelationship,
  houseSimilarity,
  relevanceScore,
  temporalProximity,
  type RelevanceComponents,
} from "../../lib/engine/relevance";
import { cosineSimilarity, jaccard } from "../../lib/utils/math";

const T = "2026-09-16T12:00:00.000Z";
const base: RelevanceComponents = { concept: 0.2, house: 0.5, graph: 0, temporal: 0.5, feedback: 0.5 };
const rel = (over: Partial<Relation>): Relation => ({
  id: "r",
  sourceId: "f",
  targetId: "c",
  type: "supports",
  confidence: 0.8,
  rationale: null,
  origin: "user",
  status: "accepted",
  createdAt: T,
  ...over,
});

describe("math", () => {
  it("computes cosine similarity and handles zero vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 2])).toThrow();
  });

  it("computes Jaccard similarity, 0 when both sets are empty", () => {
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    expect(jaccard([], [])).toBe(0);
    expect(jaccard(["a", "a"], ["a"])).toBe(1);
  });
});

describe("SPEC §19 relevance", () => {
  it("uses the frozen weights", () => {
    expect(relevanceScore({ concept: 1, house: 0, graph: 0, temporal: 0, feedback: 0 })).toBeCloseTo(0.35);
    expect(relevanceScore({ concept: 0, house: 1, graph: 0, temporal: 0, feedback: 0 })).toBeCloseTo(0.25);
    expect(relevanceScore({ concept: 0, house: 0, graph: 1, temporal: 0, feedback: 0 })).toBeCloseTo(0.2);
    expect(relevanceScore({ concept: 0, house: 0, graph: 0, temporal: 1, feedback: 0 })).toBeCloseTo(0.1);
    expect(relevanceScore({ concept: 0, house: 0, graph: 0, temporal: 0, feedback: 1 })).toBeCloseTo(0.1);
    expect(relevanceScore({ concept: 1, house: 1, graph: 1, temporal: 1, feedback: 1 })).toBeCloseTo(1);
  });

  it("shared concepts increase relevance", () => {
    const low = conceptSimilarity(["a", "b"], ["c"]);
    const high = conceptSimilarity(["a", "b"], ["a", "b"]);
    expect(high).toBeGreaterThan(low);
    expect(relevanceScore({ ...base, concept: high })).toBeGreaterThan(relevanceScore({ ...base, concept: low }));
    expect(conceptSimilarity([], [])).toBe(0);
  });

  it("house similarity increases relevance", () => {
    const a = houseVector(0.05);
    a[5] = 0.9;
    const same = { ...a };
    const other = houseVector(0.05);
    other[10] = 0.9;
    expect(houseSimilarity(a, same)).toBeCloseTo(1);
    expect(houseSimilarity(a, same)).toBeGreaterThan(houseSimilarity(a, other));
    expect(houseSimilarity(a, null)).toBe(0);
  });

  it("direct relations increase relevance: accepted > proposed > two-hop > none; rejected ignored", () => {
    const accepted = graphRelationship("f", "c", [rel({ status: "accepted", confidence: 0.8 })]);
    const proposed = graphRelationship("f", "c", [rel({ status: "proposed", confidence: 0.8 })]);
    const reverse = graphRelationship("f", "c", [rel({ sourceId: "c", targetId: "f", confidence: 0.8 })]);
    const twoHop = graphRelationship("f", "c", [rel({ targetId: "x" }), rel({ id: "r2", sourceId: "x", targetId: "c" })]);
    const rejected = graphRelationship("f", "c", [rel({ status: "rejected" })]);
    const rejectedHop = graphRelationship("f", "c", [rel({ targetId: "x", status: "rejected" }), rel({ id: "r2", sourceId: "x", targetId: "c" })]);
    expect(accepted).toBeCloseTo(0.8);
    expect(reverse).toBeCloseTo(0.8);
    expect(proposed).toBeCloseTo(0.6);
    expect(twoHop).toBe(0.4);
    expect(rejected).toBe(0);
    expect(rejectedHop).toBe(0);
    expect(graphRelationship("f", "c", [])).toBe(0);
    expect(relevanceScore({ ...base, graph: accepted })).toBeGreaterThan(relevanceScore(base));
  });

  it("recent objects receive a temporal boost", () => {
    const sameDay = temporalProximity(T, "2026-09-16T00:00:00.000Z");
    const monthsAgo = temporalProximity(T, "2026-05-16T12:00:00.000Z");
    expect(temporalProximity(T, T)).toBe(1);
    expect(temporalProximity(T, "2026-08-02T12:00:00.000Z")).toBeCloseTo(Math.exp(-1));
    expect(sameDay).toBeGreaterThan(monthsAgo);
    expect(temporalProximity("2026-08-02T12:00:00.000Z", T)).toBeCloseTo(Math.exp(-1));
  });

  it("dismissed objects receive a feedback penalty; the most recent meaningful feedback counts", () => {
    expect(feedbackAffinity([])).toBe(0.5);
    expect(feedbackAffinity(["useful"])).toBe(1);
    expect(feedbackAffinity(["saved"])).toBe(1);
    expect(feedbackAffinity(["opened"])).toBe(0.7);
    expect(feedbackAffinity(["dismissed"])).toBe(0.2);
    expect(feedbackAffinity(["not_useful"])).toBe(0);
    expect(feedbackAffinity(["useful", "dismissed"])).toBe(0.2);
    expect(feedbackAffinity(["dismissed", "acted_on"])).toBe(0.2);
    expect(feedbackAffinity(["acted_on"])).toBe(0.5);
    expect(relevanceScore({ ...base, feedback: feedbackAffinity(["dismissed"]) })).toBeLessThan(relevanceScore(base));
  });
});
