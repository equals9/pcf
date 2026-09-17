import { describe, expect, it } from "vitest";
import { houseVector } from "../../lib/domain/houses";
import {
  claimSchema,
  cognitiveObjectSchema,
  cognitiveObjectTypeSchema,
  eventTypeSchema,
  feedbackActionSchema,
  houseNumberSchema,
  houseVectorSchema,
  relationSchema,
  scoreSchema,
} from "../../lib/domain/schemas";

const T = "2026-09-16T12:00:00.000Z";

const validObject = {
  id: "o1",
  type: "thought",
  content: "Maybe persistent AI memory should remain outside model weights.",
  title: null,
  createdAt: T,
  updatedAt: T,
  lastActivatedAt: null,
  importance: 0.5,
  activation: 0.5,
  status: "active",
  provenance: "user",
};

describe("CognitiveObject", () => {
  it("accepts every spec object type", () => {
    for (const type of ["thought", "idea", "question", "claim", "evidence", "belief", "decision", "experiment"]) {
      expect(cognitiveObjectTypeSchema.safeParse(type).success).toBe(true);
      expect(cognitiveObjectSchema.safeParse({ ...validObject, type }).success).toBe(true);
    }
  });

  it("rejects invalid object types", () => {
    for (const type of ["note", "page", "", "Thought"]) {
      expect(cognitiveObjectTypeSchema.safeParse(type).success).toBe(false);
      expect(cognitiveObjectSchema.safeParse({ ...validObject, type }).success).toBe(false);
    }
  });

  it("rejects importance/activation outside [0,1]", () => {
    expect(cognitiveObjectSchema.safeParse({ ...validObject, importance: 1.01 }).success).toBe(false);
    expect(cognitiveObjectSchema.safeParse({ ...validObject, activation: -0.1 }).success).toBe(false);
  });
});

describe("scores and houses", () => {
  it("rejects scores outside [0,1]", () => {
    expect(scoreSchema.safeParse(0).success).toBe(true);
    expect(scoreSchema.safeParse(1).success).toBe(true);
    expect(scoreSchema.safeParse(-0.01).success).toBe(false);
    expect(scoreSchema.safeParse(1.5).success).toBe(false);
  });

  it("rejects house numbers outside 1–12", () => {
    for (const n of [1, 6, 12]) expect(houseNumberSchema.safeParse(n).success).toBe(true);
    for (const n of [0, 13, -1, 2.5]) expect(houseNumberSchema.safeParse(n).success).toBe(false);
  });

  it("requires exactly 12 valid house scores", () => {
    expect(houseVectorSchema.safeParse(houseVector(0.2)).success).toBe(true);

    const eleven: Record<string, number> = { ...houseVector(0.2) };
    delete eleven["12"];
    expect(houseVectorSchema.safeParse(eleven).success).toBe(false);

    const thirteen = { ...houseVector(0.2), 13: 0.2 };
    expect(houseVectorSchema.safeParse(thirteen).success).toBe(false);

    const outOfRange = { ...houseVector(0.2), 5: 1.2 };
    expect(houseVectorSchema.safeParse(outOfRange).success).toBe(false);
  });
});

describe("Relation", () => {
  const rel = {
    id: "r1",
    sourceId: "a",
    targetId: "b",
    type: "supports",
    confidence: 0.8,
    rationale: null,
    origin: "user",
    status: "proposed",
    createdAt: T,
  };

  it("accepts a valid relation", () => {
    expect(relationSchema.safeParse(rel).success).toBe(true);
  });

  it("rejects self-links", () => {
    expect(relationSchema.safeParse({ ...rel, targetId: "a" }).success).toBe(false);
  });

  it("rejects unknown relation types and out-of-range confidence", () => {
    expect(relationSchema.safeParse({ ...rel, type: "linked_to" }).success).toBe(false);
    expect(relationSchema.safeParse({ ...rel, confidence: 2 }).success).toBe(false);
  });
});

describe("Claim, feedback, events", () => {
  it("validates claim polarity and confidence", () => {
    const claim = {
      id: "c1",
      objectId: "o1",
      normalizedClaim: "x",
      subject: null,
      predicate: null,
      objectText: null,
      polarity: "positive",
      scope: null,
      confidence: 0.6,
      validFrom: null,
      validTo: null,
    };
    expect(claimSchema.safeParse(claim).success).toBe(true);
    expect(claimSchema.safeParse({ ...claim, polarity: "maybe" }).success).toBe(false);
    expect(claimSchema.safeParse({ ...claim, confidence: 1.1 }).success).toBe(false);
  });

  it("accepts only the six feedback actions and twelve event types", () => {
    expect(feedbackActionSchema.options).toHaveLength(6);
    expect(feedbackActionSchema.safeParse("liked").success).toBe(false);
    expect(eventTypeSchema.options).toHaveLength(12);
    expect(eventTypeSchema.safeParse("OBJECT_DELETED").success).toBe(false);
  });
});
