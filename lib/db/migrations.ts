import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PcfDatabase } from "./database";

export const DEFAULT_MIGRATIONS_DIR = join(process.cwd(), "lib", "db", "migrations");

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/** List migration files in lexical order (e.g. 001_initial.sql, 002_....sql). */
export function listMigrations(dir: string = DEFAULT_MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Apply every unapplied .sql migration in order, each inside a transaction.
 * Applied migration names are recorded in schema_migrations so the runner is idempotent.
 */
export function runMigrations(db: PcfDatabase, dir: string = DEFAULT_MIGRATIONS_DIR): MigrationResult {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const done = new Set(
    (db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map((r) => r.name),
  );
  const record = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");

  const result: MigrationResult = { applied: [], skipped: [] };
  for (const name of listMigrations(dir)) {
    if (done.has(name)) {
      result.skipped.push(name);
      continue;
    }
    const sql = readFileSync(join(dir, name), "utf8");
    db.transaction(() => {
      db.exec(sql);
      record.run(name, new Date().toISOString());
    })();
    result.applied.push(name);
  }
  return result;
}
