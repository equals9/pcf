import type { PcfDatabase } from "../database";
import { operatorRunSchema } from "../../domain/schemas";
import type { OperatorRun } from "../../domain/types";

interface OperatorRunRow {
  id: string;
  object_id: string;
  operator: string;
  input_context_json: string;
  result_json: string;
  created_at: string;
}

function rowToRun(r: OperatorRunRow): OperatorRun {
  return {
    id: r.id,
    objectId: r.object_id,
    operator: r.operator as OperatorRun["operator"],
    inputContext: JSON.parse(r.input_context_json) as Record<string, unknown>,
    result: JSON.parse(r.result_json) as Record<string, unknown>,
    createdAt: r.created_at,
  };
}

export function insertOperatorRun(db: PcfDatabase, input: OperatorRun): OperatorRun {
  const run = operatorRunSchema.parse(input) as OperatorRun;
  db.prepare(
    "INSERT INTO operator_runs (id, object_id, operator, input_context_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(run.id, run.objectId, run.operator, JSON.stringify(run.inputContext), JSON.stringify(run.result), run.createdAt);
  return run;
}

export function getOperatorRun(db: PcfDatabase, id: string): OperatorRun | null {
  const row = db.prepare("SELECT * FROM operator_runs WHERE id = ?").get(id) as OperatorRunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function listOperatorRunsForObject(db: PcfDatabase, objectId: string): OperatorRun[] {
  const rows = db.prepare("SELECT * FROM operator_runs WHERE object_id = ? ORDER BY created_at, id").all(objectId) as OperatorRunRow[];
  return rows.map(rowToRun);
}
