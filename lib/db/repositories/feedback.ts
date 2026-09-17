import type { PcfDatabase } from "../database";
import { feedbackRecordSchema } from "../../domain/schemas";
import type { FeedbackRecord } from "../../domain/types";

interface FeedbackRow {
  id: string;
  target_type: string;
  target_id: string;
  action: string;
  created_at: string;
}

function rowToFeedback(r: FeedbackRow): FeedbackRecord {
  return { id: r.id, targetType: r.target_type, targetId: r.target_id, action: r.action as FeedbackRecord["action"], createdAt: r.created_at };
}

export function insertFeedback(db: PcfDatabase, input: FeedbackRecord): FeedbackRecord {
  const f = feedbackRecordSchema.parse(input);
  db.prepare("INSERT INTO feedback (id, target_type, target_id, action, created_at) VALUES (?, ?, ?, ?, ?)").run(
    f.id,
    f.targetType,
    f.targetId,
    f.action,
    f.createdAt,
  );
  return f;
}

/** Feedback for one target, chronological. */
export function listFeedbackForTarget(db: PcfDatabase, targetType: string, targetId: string): FeedbackRecord[] {
  const rows = db
    .prepare("SELECT * FROM feedback WHERE target_type = ? AND target_id = ? ORDER BY created_at, id")
    .all(targetType, targetId) as FeedbackRow[];
  return rows.map(rowToFeedback);
}
