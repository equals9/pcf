import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { runMigrations } from "./migrations";

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

const APP_DATABASE = Symbol.for("pcf.appDatabase");

/**
 * The application's shared connection, opened on first use with pending migrations applied.
 * Cached on globalThis so every server bundle in the process (and dev hot reloads) shares one connection.
 */
export function getAppDatabase(): PcfDatabase {
  const holder = globalThis as { [APP_DATABASE]?: PcfDatabase };
  let db = holder[APP_DATABASE];
  if (!db) {
    db = openDatabase();
    try {
      runMigrations(db);
    } catch (err) {
      db.close();
      throw err;
    }
    holder[APP_DATABASE] = db;
  }
  return db;
}
