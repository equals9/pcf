import type { CognitiveOperator } from "./types";

// SPEC.md §23 — exactly four cognitive operators (frozen).
export const COGNITIVE_OPERATORS: readonly CognitiveOperator[] = [
  "mercury_connect",
  "jupiter_expand",
  "saturn_challenge",
  "mars_act",
];
