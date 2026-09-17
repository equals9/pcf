import { describe, expect, it } from "vitest";
import { CLASSIFY_HOUSES_SYSTEM, HOUSE_SCORING_RULE, buildClassifyHousesPrompt } from "../../lib/ai/prompts/classify-houses";
import { EXTRACT_SYSTEM, buildExtractPrompt } from "../../lib/ai/prompts/extract";
import { INFER_RELATIONS_SYSTEM } from "../../lib/ai/prompts/infer-relations";
import { toJsonSchema } from "../../lib/ai/structured-output";
import { HOUSE_NUMBERS } from "../../lib/domain/houses";
import { extractionResultSchema } from "../../lib/engine/extract";
import { fallbackHouseVector, houseClassifierOutputSchema } from "../../lib/engine/house-classifier";
import { persistableProposals, relationProposalsSchema, type RelationProposal } from "../../lib/engine/relation-inference";
import { EXTRACTION, HOUSES, housesOutput } from "../fixtures/capture-fixtures";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe("SPEC §14 extraction contract", () => {
  it("accepts a valid result for every object type", () => {
    for (const type of ["thought", "idea", "question", "claim", "evidence", "belief", "decision", "experiment"]) {
      expect(ok(extractionResultSchema, { ...EXTRACTION, type })).toBe(true);
    }
  });

  it("enforces the frozen bounds", () => {
    expect(ok(extractionResultSchema, { ...EXTRACTION, type: "note" })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, title: "x".repeat(80) })).toBe(true);
    expect(ok(extractionResultSchema, { ...EXTRACTION, title: "x".repeat(81) })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, title: "   " })).toBe(false);
    const concepts = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `c${i}` }));
    expect(ok(extractionResultSchema, { ...EXTRACTION, concepts: concepts(8) })).toBe(true);
    expect(ok(extractionResultSchema, { ...EXTRACTION, concepts: concepts(9) })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, concepts: [{ name: " " }] })).toBe(false);
    const claim = EXTRACTION.claims[0];
    expect(ok(extractionResultSchema, { ...EXTRACTION, claims: [claim, claim, claim] })).toBe(true);
    expect(ok(extractionResultSchema, { ...EXTRACTION, claims: [claim, claim, claim, claim] })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, claims: [{ ...claim, polarity: "maybe" }] })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, claims: [{ ...claim, confidence: 1.2 }] })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, importanceEstimate: -0.1 })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, importanceEstimate: 1.01 })).toBe(false);
    expect(ok(extractionResultSchema, { ...EXTRACTION, unresolved: "yes" })).toBe(false);
  });

  it("produces a JSON Schema the CLI can enforce", () => {
    const json = toJsonSchema(extractionResultSchema) as { properties: Record<string, unknown>; required: string[] };
    expect(json.required).toEqual(["type", "title", "concepts", "claims", "unresolved", "importanceEstimate"]);
  });
});

describe("SPEC §13 house classifier contract", () => {
  it("accepts a valid output", () => {
    expect(ok(houseClassifierOutputSchema, HOUSES)).toBe(true);
  });

  it("requires exactly twelve scores in [0,1]", () => {
    const eleven = { ...HOUSES, scores: { ...HOUSES.scores } };
    delete (eleven.scores as Record<string, number>)["12"];
    expect(ok(houseClassifierOutputSchema, eleven)).toBe(false);
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, scores: { ...HOUSES.scores, "13": 0.5 } })).toBe(false);
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, scores: { ...HOUSES.scores, "3": 1.5 } })).toBe(false);
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, scores: { ...HOUSES.scores, "3": -0.1 } })).toBe(false);
  });

  it("does not require scores to sum to one", () => {
    expect(ok(houseClassifierOutputSchema, housesOutput({ 1: 0.9, 2: 0.9, 3: 0.9, 4: 0.9 }, [1, 2, 3, 4]))).toBe(true);
    expect(ok(houseClassifierOutputSchema, housesOutput({ 6: 0.35 }, [6]))).toBe(true);
  });

  it("requires at least one score >= 0.35", () => {
    expect(ok(houseClassifierOutputSchema, housesOutput({ 6: 0.34 }, [6]))).toBe(false);
  });

  it("requires 1-4 distinct dominant houses, each scoring >= 0.35", () => {
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, dominantHouses: [] })).toBe(false);
    const five = housesOutput({ 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5 }, [1, 2, 3, 4, 5]);
    expect(ok(houseClassifierOutputSchema, five)).toBe(false);
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, dominantHouses: [2, 2] })).toBe(false);
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, dominantHouses: [2, 8] })).toBe(true);
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, dominantHouses: [2, 1] })).toBe(false);
    expect(ok(houseClassifierOutputSchema, { ...HOUSES, dominantHouses: [13] })).toBe(false);
  });

  it("uses the exact frozen fallback vector, as a fresh copy each time", () => {
    const v = fallbackHouseVector();
    expect(HOUSE_NUMBERS.map((n) => v[n])).toEqual([0, 0, 0.5, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0]);
    v[1] = 1;
    expect(fallbackHouseVector()[1]).toBe(0);
  });

  it("states the SPEC §13 scoring rule verbatim and lists all twelve houses", () => {
    expect(HOUSE_SCORING_RULE).toBe(
      "Score semantic relevance to each domain independently. Do not force equal distribution. Do not use a natal chart, transit, personality assumption, or prediction. This is semantic classification only.",
    );
    expect(CLASSIFY_HOUSES_SYSTEM).toContain(HOUSE_SCORING_RULE);
    for (const name of ["Self", "Resources", "Expression", "Foundation", "Creation", "Practice", "Relation", "Transformation", "Meaning", "Contribution", "Network", "Beyond"]) {
      expect(CLASSIFY_HOUSES_SYSTEM).toContain(name);
    }
  });
});

describe("SPEC §18 relation inference contract", () => {
  const schema = relationProposalsSchema(["a", "b"]);
  const p = (over: Partial<RelationProposal> = {}) => ({ targetId: "a", type: "supports", confidence: 0.8, rationale: "r", ...over });

  it("allows at most three proposals, only to given candidates, only frozen relation types", () => {
    expect(ok(schema, { proposals: [] })).toBe(true);
    expect(ok(schema, { proposals: [p(), p(), p()] })).toBe(true);
    expect(ok(schema, { proposals: [p(), p(), p(), p()] })).toBe(false);
    expect(ok(schema, { proposals: [p({ targetId: "invented" })] })).toBe(false);
    expect(ok(schema, { proposals: [p({ type: "resembles" as never })] })).toBe(false);
    expect(ok(schema, { proposals: [p({ confidence: 1.1 })] })).toBe(false);
    expect(ok(schema, { proposals: [p({ rationale: " " })] })).toBe(false);
    expect(() => relationProposalsSchema([])).toThrow();
  });

  it("keeps proposals with confidence >= 0.55, one per target and type, most confident first", () => {
    const kept = persistableProposals([
      p({ targetId: "a", type: "supports", confidence: 0.6 }),
      p({ targetId: "b", type: "extends", confidence: 0.54 }),
      p({ targetId: "a", type: "supports", confidence: 0.9, rationale: "better" }),
      p({ targetId: "b", type: "contradicts", confidence: 0.55 }),
    ] as RelationProposal[]);
    expect(kept.map((k) => [k.targetId, k.type, k.confidence, k.rationale])).toEqual([
      ["a", "supports", 0.9, "better"],
      ["b", "contradicts", 0.55, "r"],
    ]);
  });
});

describe("prompt boundary", () => {
  it("keeps system prompts fixed and puts the thought only in the prompt body", () => {
    const thought = "UNIQUE-SENTINEL-4711 with \"quotes\"\nand a newline";
    for (const system of [EXTRACT_SYSTEM, CLASSIFY_HOUSES_SYSTEM, INFER_RELATIONS_SYSTEM]) expect(system).not.toContain("UNIQUE-SENTINEL");
    expect(buildExtractPrompt(thought)).toContain(JSON.stringify(thought));
    expect(buildClassifyHousesPrompt({ content: thought, title: null, concepts: [] })).toContain("UNIQUE-SENTINEL-4711");
  });

  it("encodes the frozen type-selection priority in order", () => {
    const order = ["-> question", "-> claim", "-> belief", "-> idea", "-> experiment", "-> decision", "-> evidence", "-> thought"];
    const positions = order.map((o) => EXTRACT_SYSTEM.indexOf(o));
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
