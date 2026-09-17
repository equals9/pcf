/** Clamp to the normalized score range [0, 1]. */
export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/** Cosine similarity of two equal-length vectors; 0 when either vector is all zeros. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return clamp01(dot / Math.sqrt(na * nb));
}

/** Jaccard similarity |A ∩ B| / |A ∪ B|; 0 when both sets are empty (SPEC §19). */
export function jaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}
