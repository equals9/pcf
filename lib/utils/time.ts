export function nowIso(): string {
  return new Date().toISOString();
}

/** ISO timestamp `days` days before `from` (default now). */
export function daysAgoIso(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString();
}

/** Start (inclusive) and end (exclusive) of the local calendar day containing `at`, as ISO timestamps. */
export function localDayBounds(at: Date = new Date()): { start: string; end: string } {
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const end = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** The local calendar date of `at` as YYYY-MM-DD. Slicing an ISO string would give the UTC date instead. */
export function localDateString(at: Date = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}
