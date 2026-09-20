import type { PcfDatabase } from "../database";
import { conceptSchema } from "../../domain/schemas";
import type { Concept } from "../../domain/types";
import { newId } from "../../utils/ids";
import { normalizeConceptName } from "../../utils/text";

interface ConceptRow {
  id: string;
  name: string;
  normalized_name: string;
}

function rowToConcept(r: ConceptRow): Concept {
  return { id: r.id, name: r.name, normalizedName: r.normalized_name };
}

/** Find-or-create by normalized name. The first display name seen is kept. */
export function upsertConcept(db: PcfDatabase, name: string, createdAt: string, id: string = newId()): Concept {
  const normalizedName = normalizeConceptName(name);
  const existing = db.prepare("SELECT id, name, normalized_name FROM concepts WHERE normalized_name = ?").get(normalizedName) as
    | ConceptRow
    | undefined;
  if (existing) return rowToConcept(existing);
  const c = conceptSchema.parse({ id, name: name.trim(), normalizedName });
  db.prepare("INSERT INTO concepts (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)").run(
    c.id,
    c.name,
    c.normalizedName,
    createdAt,
  );
  return c;
}

export function attachConcept(db: PcfDatabase, objectId: string, conceptId: string): void {
  db.prepare("INSERT OR IGNORE INTO object_concepts (object_id, concept_id) VALUES (?, ?)").run(objectId, conceptId);
}

export function listConceptsForObject(db: PcfDatabase, objectId: string): Concept[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.normalized_name FROM concepts c
       JOIN object_concepts oc ON oc.concept_id = c.id
       WHERE oc.object_id = ? ORDER BY c.normalized_name`,
    )
    .all(objectId) as ConceptRow[];
  return rows.map(rowToConcept);
}

/** Ids of other objects sharing at least one concept with the object (SPEC §17 step 1), in id order. */
/** Like `listObjectIdsSharingConcepts`, but only the `limit` most recently created matches. */
export function listRecentObjectIdsSharingConcepts(db: PcfDatabase, objectId: string, limit: number): string[] {
  if (limit <= 0) return [];
  const rows = db
    .prepare(
      `SELECT o.id AS id FROM objects o
       WHERE o.id <> ? AND EXISTS (
         SELECT 1 FROM object_concepts mine
         JOIN object_concepts other ON other.concept_id = mine.concept_id
         WHERE mine.object_id = ? AND other.object_id = o.id
       )
       ORDER BY o.created_at DESC, o.id DESC LIMIT ?`,
    )
    .all(objectId, objectId, limit) as { id: string }[];
  return rows.map((r) => r.id);
}

/**
 * Like `listRecentObjectIdsSharingConcepts`, but only objects that are not archived and actually hold a
 * claim, so a bound on candidates is a bound on claims rather than on empty objects (SPEC §24).
 */
export function listRecentObjectIdsSharingConceptsWithClaims(db: PcfDatabase, objectId: string, limit: number): string[] {
  if (limit <= 0) return [];
  const rows = db
    .prepare(
      `SELECT o.id AS id FROM objects o
       WHERE o.id <> ? AND o.status <> 'archived'
         AND EXISTS (SELECT 1 FROM claims c WHERE c.object_id = o.id)
         AND EXISTS (
           SELECT 1 FROM object_concepts mine
           JOIN object_concepts other ON other.concept_id = mine.concept_id
           WHERE mine.object_id = ? AND other.object_id = o.id
         )
       ORDER BY o.created_at DESC, o.id DESC LIMIT ?`,
    )
    .all(objectId, objectId, limit) as { id: string }[];
  return rows.map((r) => r.id);
}

export function listObjectIdsSharingConcepts(db: PcfDatabase, objectId: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT other.object_id AS id FROM object_concepts mine
       JOIN object_concepts other ON other.concept_id = mine.concept_id
       WHERE mine.object_id = ? AND other.object_id <> ?
       ORDER BY other.object_id`,
    )
    .all(objectId, objectId) as { id: string }[];
  return rows.map((r) => r.id);
}
