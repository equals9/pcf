import { describe, expect, it } from "vitest";
import { insertObject, listObjectsCreatedBetween } from "../../lib/db/repositories/objects";
import { dominantHouse, houseVector } from "../../lib/domain/houses";
import { localDayBounds } from "../../lib/utils/time";
import { newTestDb } from "../fixtures/capture-fixtures";

// SPEC §25C: the Today stream shows only today's objects, newest first, each with its dominant house.

function add(db: ReturnType<typeof newTestDb>, id: string, createdAt: string) {
  insertObject(db, {
    id,
    type: "thought",
    content: `content of ${id}`,
    title: null,
    createdAt,
    updatedAt: createdAt,
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
  });
}

describe("listObjectsCreatedBetween", () => {
  it("returns objects in [from, to), newest first", () => {
    const db = newTestDb();
    add(db, "before", "2026-09-16T23:59:59.999Z");
    add(db, "at-start", "2026-09-17T00:00:00.000Z");
    add(db, "morning", "2026-09-17T08:00:00.000Z");
    add(db, "evening-b", "2026-09-17T20:00:00.000Z");
    add(db, "evening-a", "2026-09-17T20:00:00.000Z");
    add(db, "at-end", "2026-09-18T00:00:00.000Z");
    const ids = listObjectsCreatedBetween(db, "2026-09-17T00:00:00.000Z", "2026-09-18T00:00:00.000Z").map((o) => o.id);
    expect(ids).toEqual(["evening-b", "evening-a", "morning", "at-start"]);
  });
});

describe("localDayBounds", () => {
  it("spans the local calendar day containing the instant", () => {
    const at = new Date(2026, 8, 17, 15, 30);
    const { start, end } = localDayBounds(at);
    expect(new Date(start).getTime()).toBe(new Date(2026, 8, 17).getTime());
    expect(new Date(end).getTime()).toBe(new Date(2026, 8, 18).getTime());
    expect(Date.parse(start)).toBeLessThanOrEqual(at.getTime());
    expect(Date.parse(end)).toBeGreaterThan(at.getTime());
  });

  it("includes the first and excludes the next local midnight", () => {
    const midnight = new Date(2026, 8, 17);
    expect(localDayBounds(midnight).start).toBe(midnight.toISOString());
    expect(localDayBounds(new Date(2026, 8, 17, 23, 59, 59, 999)).end).toBe(new Date(2026, 8, 18).toISOString());
  });
});

describe("dominantHouse", () => {
  it("picks the highest score", () => {
    const v = houseVector(0.1);
    v[7] = 0.9;
    v[2] = 0.8;
    expect(dominantHouse(v)).toBe(7);
  });

  it("gives ties to the lowest house number (SPEC §21), including the §13 fallback", () => {
    const v = houseVector(0);
    v[9] = 0.5;
    v[5] = 0.5;
    v[3] = 0.5;
    expect(dominantHouse(v)).toBe(3);
    expect(dominantHouse(houseVector(0))).toBe(1);
  });
});
