import type { PcfDatabase } from "../database";
import { relationSchema, relationStatusSchema } from "../../domain/schemas";
import type { Relation, RelationStatus } from "../../domain/types";

interface RelationRow {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  confidence: number;
  rationale: string | null;
  origin: string;
  status: string;
  created_at: string;
}

function rowToRelation(r: RelationRow): Relation {
  return {
    id: r.id,
    sourceId: r.source_id,
    targetId: r.target_id,
    type: r.type as Relation["type"],
    confidence: r.confidence,
    rationale: r.rationale,
    origin: r.origin as Relation["origin"],
    status: r.status as Relation["status"],
    createdAt: r.created_at,
  };
}

export function insertRelation(db: PcfDatabase, input: Relation): Relation {
  const r = relationSchema.parse(input) as Relation;
  db.prepare(
    `INSERT INTO relations (id, source_id, target_id, type, confidence, rationale, origin, status, created_at)
     VALUES (@id, @sourceId, @targetId, @type, @confidence, @rationale, @origin, @status, @createdAt)`,
  ).run(r);
  return r;
}

export function getRelation(db: PcfDatabase, id: string): Relation | null {
  const row = db.prepare("SELECT * FROM relations WHERE id = ?").get(id) as RelationRow | undefined;
  return row ? rowToRelation(row) : null;
}

/** Relations where the object is source or target, oldest first. */
export function listRelationsForObject(db: PcfDatabase, objectId: string): Relation[] {
  const rows = db
    .prepare("SELECT * FROM relations WHERE source_id = ? OR target_id = ? ORDER BY created_at, id")
    .all(objectId, objectId) as RelationRow[];
  return rows.map(rowToRelation);
}

/** Status transitions only; history of acceptance/rejection is recorded via events (SPEC §11). */
export function setRelationStatus(db: PcfDatabase, id: string, status: RelationStatus): void {
  const s = relationStatusSchema.parse(status);
  const info = db.prepare("UPDATE relations SET status = ? WHERE id = ?").run(s, id);
  if (info.changes === 0) throw new Error(`relation not found: ${id}`);
}
