import type { PcfDatabase } from "../database";
import { cognitiveEventSchema } from "../../domain/schemas";
import type { CognitiveEvent, EventType } from "../../domain/types";
import { newId } from "../../utils/ids";
import { nowIso } from "../../utils/time";

interface EventRow {
  id: string;
  type: string;
  object_id: string | null;
  payload_json: string;
  created_at: string;
}

function rowToEvent(r: EventRow): CognitiveEvent {
  return {
    id: r.id,
    type: r.type as EventType,
    objectId: r.object_id,
    payload: JSON.parse(r.payload_json) as Record<string, unknown>,
    createdAt: r.created_at,
  };
}

export interface AppendEventInput {
  type: EventType;
  objectId?: string | null;
  payload?: Record<string, unknown>;
  id?: string;
  createdAt?: string;
}

/** Append-only (SPEC §11). Events are never updated or deleted by application code. */
export function appendEvent(db: PcfDatabase, input: AppendEventInput): CognitiveEvent {
  const e = cognitiveEventSchema.parse({
    id: input.id ?? newId(),
    type: input.type,
    objectId: input.objectId ?? null,
    payload: input.payload ?? {},
    createdAt: input.createdAt ?? nowIso(),
  }) as CognitiveEvent;
  db.prepare("INSERT INTO events (id, type, object_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)").run(
    e.id,
    e.type,
    e.objectId,
    JSON.stringify(e.payload),
    e.createdAt,
  );
  return e;
}

export interface EventFilter {
  type?: EventType;
  objectId?: string;
}

/** Events in chronological order, optionally filtered by type and/or object. */
export function listEvents(db: PcfDatabase, filter: EventFilter = {}): CognitiveEvent[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.type) {
    where.push("type = ?");
    params.push(filter.type);
  }
  if (filter.objectId) {
    where.push("object_id = ?");
    params.push(filter.objectId);
  }
  const sql = `SELECT * FROM events${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY created_at, rowid`;
  return (db.prepare(sql).all(...params) as EventRow[]).map(rowToEvent);
}
