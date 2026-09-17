export function nowIso(): string {
  return new Date().toISOString();
}

/** ISO timestamp `days` days before `from` (default now). */
export function daysAgoIso(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString();
}
