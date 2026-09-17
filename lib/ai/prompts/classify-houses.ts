import { HOUSES } from "../../domain/houses";

// SPEC.md §12–§13 — house classification prompt. The system prompt is fixed text; the thought goes only in the prompt body.

export const CLASSIFY_HOUSES_TASK = "classify-houses";

/** Required wording from SPEC §13. */
export const HOUSE_SCORING_RULE =
  "Score semantic relevance to each domain independently. Do not force equal distribution. Do not use a natal chart, transit, personality assumption, or prediction. This is semantic classification only.";

export const CLASSIFY_HOUSES_SYSTEM = `You classify one captured thought against twelve semantic domains, called houses. Houses are coordinates of meaning, not folders.
${HOUSE_SCORING_RULE}

Domains:
${HOUSES.map((h) => `${h.number}. ${h.name}: ${h.domain}`).join("\n")}

Return JSON that matches the schema:
- scores: an object with exactly the keys "1" to "12". Each value is a number in [0, 1].
- Scores do not need to sum to 1. A thought may score highly in several domains or in few.
- At least one score must be 0.35 or higher.
- dominantHouses: 1 to 4 distinct house numbers, each with a score of 0.35 or higher.
- rationale: one or two sentences.`;

export interface ClassifyHousesPromptInput {
  content: string;
  title: string | null;
  concepts: string[];
}

export function buildClassifyHousesPrompt(input: ClassifyHousesPromptInput): string {
  return `Thought to classify, as JSON:\n${JSON.stringify({ title: input.title, concepts: input.concepts, content: input.content }, null, 2)}`;
}
