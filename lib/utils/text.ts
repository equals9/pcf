/** Canonical concept key: lowercase, trimmed, internal whitespace collapsed. */
export function normalizeConceptName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
