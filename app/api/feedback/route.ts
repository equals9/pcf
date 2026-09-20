import { getAppDatabase } from "../../../lib/db/database";
import { feedbackActionSchema } from "../../../lib/domain/schemas";
import type { FeedbackAction } from "../../../lib/domain/types";
import { TENSION_FEEDBACK_TARGET, dismissTension } from "../../../lib/engine/contradiction";
import { FEEDBACK_TARGET_TYPES, recordFeedback, type FeedbackTargetType } from "../../../lib/engine/operator-runner";
import { isLoopbackRequest } from "../../../lib/utils/local-request";

// SPEC.md §26 — POST /api/feedback. Feedback is canonical user evidence: it is stored beside the operator
// result, never rewrites it, and v0.1 learns nothing from it (§39).

export interface FeedbackErrorBody {
  error: "forbidden" | "unsupported_media_type" | "invalid_request" | "not_found" | "feedback_failed";
  message: string;
}

const fail = (status: number, body: FeedbackErrorBody) => Response.json(body, { status });

export async function POST(request: Request): Promise<Response> {
  if (!isLoopbackRequest(request.headers)) {
    return fail(403, { error: "forbidden", message: "PCF only answers requests addressed to localhost." });
  }
  if (!/^application\/json\s*(;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return fail(415, { error: "unsupported_media_type", message: "Send the request as application/json." });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, { error: "invalid_request", message: "The request body is not valid JSON." });
  }
  const { targetType, targetId, action } = (body ?? {}) as { targetType?: unknown; targetId?: unknown; action?: unknown };

  // §25F "Not a conflict": a tension is dismissed by its claim pair, and the dismissal is recorded as both
  // user feedback and a CONTRADICTION_DISMISSED event.
  if (targetType === TENSION_FEEDBACK_TARGET) {
    const { claimAId, claimBId } = (body ?? {}) as { claimAId?: unknown; claimBId?: unknown };
    if (typeof claimAId !== "string" || typeof claimBId !== "string" || claimAId.length === 0 || claimBId.length === 0) {
      return fail(400, { error: "invalid_request", message: 'Send {"targetType": "contradiction", "claimAId": "...", "claimBId": "..."}.' });
    }
    try {
      const outcome = dismissTension(getAppDatabase(), { claimAId, claimBId });
      if (outcome.status === "target_not_found") {
        return fail(404, { error: "not_found", message: "No claim pair with those ids." });
      }
      return Response.json(outcome.feedback);
    } catch (err) {
      console.error(`[pcf feedback] ${JSON.stringify({ operation: "dismiss-tension", outcome: "failed", errorKind: err instanceof Error ? err.name : typeof err })}`);
      return fail(500, { error: "feedback_failed", message: "Your feedback could not be recorded." });
    }
  }

  if (
    typeof targetType !== "string" ||
    !FEEDBACK_TARGET_TYPES.includes(targetType as FeedbackTargetType) ||
    typeof targetId !== "string" ||
    targetId.length === 0 ||
    !feedbackActionSchema.safeParse(action).success
  ) {
    return fail(400, { error: "invalid_request", message: 'Send {"targetType": "operator_run" | "object" | "contradiction", ...}.' });
  }

  try {
    const outcome = recordFeedback(
      { db: getAppDatabase() },
      { targetType: targetType as FeedbackTargetType, targetId, action: action as FeedbackAction },
    );
    if (outcome.status === "target_not_found") {
      return fail(404, { error: "not_found", message: "No operator result or thought with that id." });
    }
    return Response.json(outcome.feedback);
  } catch (err) {
    console.error(`[pcf feedback] ${JSON.stringify({ operation: "feedback-route", outcome: "failed", errorKind: err instanceof Error ? err.name : typeof err })}`);
    return fail(500, { error: "feedback_failed", message: "Your feedback could not be recorded." });
  }
}
