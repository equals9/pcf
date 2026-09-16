import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { openDatabase } from "../../lib/db/database";
import { listMigrations, runMigrations } from "../../lib/db/migrations";

const FIXTURES = join(__dirname, "..", "fixtures", "migrations");

describe("SQLite connection", () => {
  it("opens with foreign keys enabled", () => {
    const db = openDatabase(":memory:");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    db.close();
  });
});

describe("migration runner", () => {
  it("lists .sql migrations in lexical order", () => {
    expect(listMigrations(FIXTURES)).toEqual(["001_fixture.sql", "002_fixture.sql"]);
  });

  it("applies migrations once and is idempotent", () => {
    const db = openDatabase(":memory:");

    const first = runMigrations(db, FIXTURES);
    expect(first.applied).toEqual(["001_fixture.sql", "002_fixture.sql"]);
    expect(first.skipped).toEqual([]);

    const cols = (db.prepare("PRAGMA table_info(fixture_items)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(["id", "name", "created_at"]);

    const second = runMigrations(db, FIXTURES);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["001_fixture.sql", "002_fixture.sql"]);

    db.close();
  });
});
