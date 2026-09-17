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
