import { z } from "zod";
import { EXTRACT_SYSTEM, EXTRACT_TASK, buildExtractPrompt } from "../ai/prompts/extract";
import type { Reasoner } from "../ai/reasoner";
import { claimPolaritySchema, cognitiveObjectTypeSchema, scoreSchema } from "../domain/schemas";
import type { CognitiveObjectType } from "../domain/types";

// SPEC.md §14 — extraction contract.

export const MAX_TITLE_CHARS = 80;
export const MAX_CONCEPTS = 8;
export const MAX_CLAIMS = 3;

export interface ExtractionInput {
  content: string;
}

const nullableText = z.string().nullable();

export const extractionResultSchema = z.object({
  type: cognitiveObjectTypeSchema,
  title: z.string().trim().min(1).max(MAX_TITLE_CHARS),
  concepts: z.array(z.object({ name: z.string().trim().min(1) })).max(MAX_CONCEPTS),
  claims: z
    .array(
      z.object({
        normalizedClaim: z.string().trim().min(1),
        subject: nullableText,
        predicate: nullableText,
        objectText: nullableText,
        polarity: claimPolaritySchema,
        scope: nullableText,
        confidence: scoreSchema,
      }),
    )
    .max(MAX_CLAIMS),
  unresolved: z.boolean(),
  importanceEstimate: scoreSchema,
});

export type ExtractionResult = z.infer<typeof extractionResultSchema> & { type: CognitiveObjectType };

/** One reasoner call. Malformed output is retried inside the reasoner (at most once); this function never retries. */
export async function runExtraction(reasoner: Reasoner, input: ExtractionInput): Promise<ExtractionResult> {
  const result = await reasoner.runStructured({
    task: EXTRACT_TASK,
    system: EXTRACT_SYSTEM,
    prompt: buildExtractPrompt(input.content),
    schema: extractionResultSchema,
  });
  return result as ExtractionResult;
}
