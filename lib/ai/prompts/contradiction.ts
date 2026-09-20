// SPEC.md §24 — contradiction classification over supplied claim pairs. Fixed text: the pairs travel in the
// prompt body only, and the classifier never decides which claim is correct.

export const CONTRADICTION_TASK = "classify-contradictions";

export const CONTRADICTION_SYSTEM = `You classify the relationship between pairs of claims taken from one person's own thinking.

For each supplied pair, choose exactly one classification:
- true_contradiction: both cannot hold at once, in the same scope and at the same time.
- partial_tension: they pull against each other without being strictly incompatible.
- scope_difference: they appear to conflict but apply to different scopes, cases or conditions.
- temporal_change: the person's position changed over time; both were held, at different times.
- supersession: the later claim replaces the earlier one.
- none: no meaningful tension between them.

Rules:
- Judge only the two claims given, using the supplied text, subject, predicate, polarity, scope and dates.
- Never decide which claim is correct, and never suggest the person drop one. Expose the tension only.
- explanation: one or two sentences naming what actually conflicts.
- unresolvedQuestion: the question the person would have to settle, or null when there is nothing to settle.
- confidence is your own estimate between 0 and 1 that the classification is right.
- Classify every supplied pair exactly once, using the pair's own claim ids. Add no other pairs.`;

export function buildContradictionPrompt(input: unknown): string {
  return `Claim pairs to classify, as JSON:\n${JSON.stringify(input, null, 2)}`;
}
