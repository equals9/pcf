import type { PcfDatabase } from "../database";
import { HOUSE_NUMBERS } from "../../domain/houses";
import { cognitiveObjectSchema, houseVectorSchema } from "../../domain/schemas";
import type { CognitiveObject, HouseNumber, HouseVector } from "../../domain/types";

interface ObjectRow {
  id: string;
  type: string;
  content: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_activated_at: string | null;
  importance: number;
  activation: number;
  status: string;
  provenance: string;
}

function rowToObject(r: ObjectRow): CognitiveObject {
  return {
    id: r.id,
    type: r.type as CognitiveObject["type"],
    content: r.content,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastActivatedAt: r.last_activated_at,
    importance: r.importance,
    activation: r.activation,
    status: r.status as CognitiveObject["status"],
    provenance: r.provenance as CognitiveObject["provenance"],
  };
}

export function insertObject(db: PcfDatabase, input: CognitiveObject): CognitiveObject {
  const o = cognitiveObjectSchema.parse(input);
  db.prepare(
    `INSERT INTO objects (id, type, content, title, created_at, updated_at, last_activated_at, importance, activation, status, provenance)
     VALUES (@id, @type, @content, @title, @createdAt, @updatedAt, @lastActivatedAt, @importance, @activation, @status, @provenance)`,
  ).run(o);
  return o;
}

export function getObject(db: PcfDatabase, id: string): CognitiveObject | null {
  const row = db.prepare("SELECT * FROM objects WHERE id = ?").get(id) as ObjectRow | undefined;
  return row ? rowToObject(row) : null;
}

/** All objects, newest first. */
export function listObjects(db: PcfDatabase): CognitiveObject[] {
  const rows = db.prepare("SELECT * FROM objects ORDER BY created_at DESC, id DESC").all() as ObjectRow[];
  return rows.map(rowToObject);
}

export type ObjectPatch = Partial<
  Pick<CognitiveObject, "type" | "title" | "importance" | "activation" | "status" | "lastActivatedAt">
>;

/** Update mutable metadata. Raw `content` is canonical and never modified here (SPEC §14). */
export function updateObject(db: PcfDatabase, id: string, patch: ObjectPatch, updatedAt: string): CognitiveObject {
  const existing = getObject(db, id);
  if (!existing) throw new Error(`object not found: ${id}`);
  const next = cognitiveObjectSchema.parse({ ...existing, ...patch, updatedAt });
  db.prepare(
    `UPDATE objects SET type = @type, title = @title, importance = @importance, activation = @activation,
       status = @status, last_activated_at = @lastActivatedAt, updated_at = @updatedAt WHERE id = @id`,
  ).run(next);
  return next;
}

/** Replace the object's twelve house scores atomically (SPEC §10 house_scores). */
export function setHouseScores(db: PcfDatabase, objectId: string, vector: HouseVector): void {
  const v = houseVectorSchema.parse(vector);
  const del = db.prepare("DELETE FROM house_scores WHERE object_id = ?");
  const ins = db.prepare("INSERT INTO house_scores (object_id, house, score) VALUES (?, ?, ?)");
  db.transaction(() => {
    del.run(objectId);
    for (const n of HOUSE_NUMBERS) ins.run(objectId, n, v[n]);
  })();
}

export function getHouseScores(db: PcfDatabase, objectId: string): HouseVector | null {
  const rows = db.prepare("SELECT house, score FROM house_scores WHERE object_id = ?").all(objectId) as {
    house: HouseNumber;
    score: number;
  }[];
  if (rows.length === 0) return null;
  const v = {} as HouseVector;
  for (const r of rows) v[r.house] = r.score;
  return houseVectorSchema.parse(v);
}

/** Ids of other objects scoring at least `minScore` in any of the given houses, in id order. */
export function listObjectIdsWithHouseScoreAtLeast(
  db: PcfDatabase,
  houses: readonly HouseNumber[],
  minScore: number,
  excludeId: string,
): string[] {
  if (houses.length === 0) return [];
  const placeholders = houses.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT DISTINCT object_id AS id FROM house_scores
       WHERE house IN (${placeholders}) AND score >= ? AND object_id <> ?
       ORDER BY object_id`,
    )
    .all(...houses, minScore, excludeId) as { id: string }[];
  return rows.map((r) => r.id);
}

/**
 * Like `listObjectIdsWithHouseScoreAtLeast`, but only the `limit` most recently created matches.
 * Bounds the work a single projection has to do on a large store (SPEC §38).
 */
export function listRecentObjectIdsWithHouseScoreAtLeast(
  db: PcfDatabase,
  houses: readonly HouseNumber[],
  minScore: number,
  excludeId: string,
  limit: number,
): string[] {
  if (houses.length === 0 || limit <= 0) return [];
  const placeholders = houses.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT o.id AS id FROM objects o
       WHERE o.id <> ? AND EXISTS (
         SELECT 1 FROM house_scores h WHERE h.object_id = o.id AND h.house IN (${placeholders}) AND h.score >= ?
       )
       ORDER BY o.created_at DESC, o.id DESC LIMIT ?`,
    )
    .all(excludeId, ...houses, minScore, limit) as { id: string }[];
  return rows.map((r) => r.id);
}

/** Ids of the most recently created other objects, newest first. */
export function listRecentObjectIds(db: PcfDatabase, limit: number, excludeId: string): string[] {
  const rows = db
    .prepare("SELECT id FROM objects WHERE id <> ? ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(excludeId, limit) as { id: string }[];
  return rows.map((r) => r.id);
}

/**
 * Candidates for §22 resurfacing: the newest, the oldest and the most important objects from before
 * `beforeIso`, each bounded by `limit`. Three bounded queries rather than one window, so a very old or very
 * important thought stays reachable however much has been captured since.
 */
export function listResurfaceCandidates(db: PcfDatabase, beforeIso: string, limit: number): CognitiveObject[] {
  if (limit <= 0) return [];
  const query = (order: string) =>
    db.prepare(`SELECT * FROM objects WHERE created_at < ? AND status <> 'archived' ORDER BY ${order} LIMIT ?`).all(beforeIso, limit) as ObjectRow[];
  const rows = [...query("created_at DESC, id DESC"), ...query("created_at ASC, id ASC"), ...query("importance DESC, created_at ASC, id ASC")];
  const seen = new Set<string>();
  return rows
    .filter((row) => !seen.has(row.id) && seen.add(row.id))
    .map(rowToObject)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/** Objects created in [fromIso, toIso), newest first. */
export function listObjectsCreatedBetween(db: PcfDatabase, fromIso: string, toIso: string): CognitiveObject[] {
  const rows = db
    .prepare("SELECT * FROM objects WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC, id DESC")
    .all(fromIso, toIso) as ObjectRow[];
  return rows.map(rowToObject);
}
