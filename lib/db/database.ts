import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

export const DEFAULT_DB_PATH = "./data/pcf.db";

export type PcfDatabase = Database.Database;

/**
 * Open the canonical local SQLite database.
 * Defaults to ./data/pcf.db (SPEC.md §10). Pass ":memory:" for tests.
 */
export function openDatabase(filePath: string = process.env.PCF_DB_PATH ?? DEFAULT_DB_PATH): PcfDatabase {
  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
