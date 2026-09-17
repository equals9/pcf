import { z } from "zod";
import { CLASSIFY_HOUSES_SYSTEM, CLASSIFY_HOUSES_TASK, buildClassifyHousesPrompt } from "../ai/prompts/classify-houses";
import type { Reasoner } from "../ai/reasoner";
import { HOUSE_NUMBERS, houseVector } from "../domain/houses";
import { houseNumberSchema, scoreSchema } from "../domain/schemas";
import type { HouseNumber, HouseVector } from "../domain/types";

// SPEC.md §13 — house classifier contract.

export const DOMINANT_HOUSE_MIN_SCORE = 0.35;
export const MIN_DOMINANT_HOUSES = 1;
export const MAX_DOMINANT_HOUSES = 4;

export interface HouseClassifierInput {
  content: string;
  title: string | null;
  concepts: string[];
}

export interface HouseClassifierOutput {
  scores: HouseVector;
  dominantHouses: HouseNumber[];
  rationale: string;
}

const scoresSchema = z.object(Object.fromEntries(HOUSE_NUMBERS.map((n) => [String(n), scoreSchema]))).strict();

export const houseClassifierOutputSchema = z
  .object({
    scores: scoresSchema,
    dominantHouses: z.array(houseNumberSchema).min(MIN_DOMINANT_HOUSES).max(MAX_DOMINANT_HOUSES),
    rationale: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    const scores = value.scores as Record<string, number>;
    if (!Object.values(scores).some((s) => s >= DOMINANT_HOUSE_MIN_SCORE)) {
      ctx.addIssue({ code: "custom", path: ["scores"], message: `at least one score must be >= ${DOMINANT_HOUSE_MIN_SCORE}` });
    }
    if (new Set(value.dominantHouses).size !== value.dominantHouses.length) {
      ctx.addIssue({ code: "custom", path: ["dominantHouses"], message: "dominant houses must be distinct" });
    }
    value.dominantHouses.forEach((h, i) => {
      if ((scores[String(h)] ?? 0) < DOMINANT_HOUSE_MIN_SCORE) {
        ctx.addIssue({ code: "custom", path: ["dominantHouses", i], message: `dominant house ${h} must score >= ${DOMINANT_HOUSE_MIN_SCORE}` });
      }
    });
  });

/** SPEC §13 neutral fallback: all houses 0, except Houses 3, 5 and 9 at 0.5. */
export function fallbackHouseVector(): HouseVector {
  const v = houseVector(0);
  v[3] = 0.5;
  v[5] = 0.5;
  v[9] = 0.5;
  return v;
}

/** Houses at or above the dominant-house threshold, in house order. */
export function housesAtOrAbove(vector: HouseVector, min: number = DOMINANT_HOUSE_MIN_SCORE): HouseNumber[] {
  return HOUSE_NUMBERS.filter((n) => vector[n] >= min);
}

/** One reasoner call. The reasoner retries malformed output at most once, with the validation errors. */
export async function classifyHouses(reasoner: Reasoner, input: HouseClassifierInput): Promise<HouseClassifierOutput> {
  const out = await reasoner.runStructured({
    task: CLASSIFY_HOUSES_TASK,
    system: CLASSIFY_HOUSES_SYSTEM,
    prompt: buildClassifyHousesPrompt(input),
    schema: houseClassifierOutputSchema,
  });
  const scores = houseVector(0);
  for (const n of HOUSE_NUMBERS) scores[n] = (out.scores as Record<string, number>)[String(n)];
  return { scores, dominantHouses: out.dominantHouses as HouseNumber[], rationale: out.rationale };
}
