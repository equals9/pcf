import { RELATION_TYPES } from "../../domain/relations";

// SPEC.md §18 — relation inference prompt. The system prompt is fixed text; objects go only in the prompt body.

export const INFER_RELATIONS_TASK = "infer-relations";

export const INFER_RELATIONS_SYSTEM = `You propose typed relationships between a new thought (the source) and existing thoughts (the candidates) in a personal thinking tool.
You only propose. The user decides later whether to accept each proposal.

Rules:
- Propose at most 3 relationships. Return an empty list when none is meaningful.
- targetId must be the id of one of the given candidates. Never invent ids.
- type must be one of: ${RELATION_TYPES.join(", ")}. A proposal reads "source <type> target".
- Propose a relationship only when the text of both thoughts supports it. Shared words alone are not enough.
- confidence is a number in [0, 1]. Proposals below 0.55 are discarded.
- rationale is one sentence explaining the relationship.`;

export interface InferRelationsPromptInput {
  source: { id: string; type: string; title: string | null; content: string };
  candidates: Array<{
    id: string;
    type: string;
    title: string | null;
    content: string;
    sharedConcepts: string[];
    houseSimilarity: number;
  }>;
}

export function buildInferRelationsPrompt(input: InferRelationsPromptInput): string {
  return `Source and candidates, as JSON:\n${JSON.stringify(input, null, 2)}`;
}
