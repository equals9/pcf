import { describe, expect, it } from "vitest";
import { openDatabase } from "../../lib/db/database";
import { runMigrations } from "../../lib/db/migrations";
import { listAllClaims } from "../../lib/db/repositories/claims";
import { listEvents } from "../../lib/db/repositories/events";
import { getHouseScores, listObjects } from "../../lib/db/repositories/objects";
import { listRelationsForObject } from "../../lib/db/repositories/relations";
import { seedDemo } from "../../scripts/seed-demo";

const NOW = new Date("2026-09-16T12:00:00.000Z");

describe("seed-demo", () => {
  it("creates the SPEC §35 synthetic dataset deterministically and idempotently", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);

    const summary = seedDemo(db, NOW);
    expect(summary).not.toBeNull();
    expect(summary!.objects).toBeGreaterThanOrEqual(14);
    expect(summary!.objects).toBeLessThanOrEqual(16);

    const objects = listObjects(db);
    expect(objects).toHaveLength(summary!.objects);
    for (const o of objects) expect(getHouseScores(db, o.id)).not.toBeNull();

    // two related claims + one deliberate contradiction
    const claims = listAllClaims(db);
    expect(claims.length).toBeGreaterThanOrEqual(2);
    const rels = listRelationsForObject(db, "seed-02");
    expect(rels.some((r) => r.type === "contradicts" && r.status === "accepted")).toBe(true);
    expect(rels.some((r) => r.type === "supports")).toBe(true);

    // one old unresolved question (> 60 days)
    const oldQuestion = objects.find((o) => o.type === "question" && o.status === "active" && Date.parse(o.createdAt) < NOW.getTime() - 60 * 86_400_000);
    expect(oldQuestion).toBeDefined();

    // cross-house ideas: at least two ideas with >= 2 houses scoring >= 0.5
    const crossHouseIdeas = objects.filter((o) => o.type === "idea" && Object.values(getHouseScores(db, o.id)!).filter((s) => s >= 0.5).length >= 2);
    expect(crossHouseIdeas.length).toBeGreaterThanOrEqual(2);

    // event coverage per object
    for (const o of objects) {
      const types = listEvents(db, { objectId: o.id }).map((e) => e.type);
      expect(types).toContain("OBJECT_CAPTURED");
      expect(types).toContain("OBJECT_EXTRACTED");
      expect(types).toContain("HOUSE_CLASSIFIED");
    }

    // deterministic content and timestamps for a fixed `now`
    const first = objects.map((o) => [o.id, o.createdAt, o.title]);
    const db2 = openDatabase(":memory:");
    runMigrations(db2);
    seedDemo(db2, NOW);
    expect(listObjects(db2).map((o) => [o.id, o.createdAt, o.title])).toEqual(first);
    db2.close();

    // idempotent
    expect(seedDemo(db, NOW)).toBeNull();
    expect(listObjects(db)).toHaveLength(summary!.objects);
    db.close();
  });

  it("contains no private user data markers", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    seedDemo(db, NOW);
    const text = listObjects(db).map((o) => `${o.title} ${o.content}`).join(" ");
    expect(text).not.toMatch(/@|\bhttps?:\/\/|\b\d{3}[-.]\d{3}[-.]\d{4}\b/);
    db.close();
  });
});
