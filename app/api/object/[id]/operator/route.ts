import { ClaudeSubscriptionReasoner } from "../../../../../lib/ai/claude-subscription";
import { getAppDatabase } from "../../../../../lib/db/database";
import { COGNITIVE_OPERATORS } from "../../../../../lib/domain/operators";
import type { CognitiveOperator } from "../../../../../lib/domain/types";
import { runOperator } from "../../../../../lib/engine/operator-runner";
import { isLoopbackRequest } from "../../../../../lib/utils/local-request";

// SPEC.md §26 — POST /api/object/:id/operator. A thin adapter over the operator engine: no prompts, no
// retrieval and no persistence of its own, and no retry beyond the one the reasoner already owns.

export interface OperatorErrorBody {
  error: "forbidden" | "unsupported_media_type" | "invalid_request" | "not_found" | "not_classified" | "operator_failed";
  message: string;
}

const fail = (status: number, body: OperatorErrorBody) => Response.json(body, { status });

export async function POST(request: Request, context: RouteContext<"/api/object/[id]/operator">): Promise<Response> {
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
  const operator = (body as { operator?: unknown } | null)?.operator;
  if (typeof operator !== "string" || !COGNITIVE_OPERATORS.includes(operator as CognitiveOperator)) {
    return fail(400, { error: "invalid_request", message: `operator must be one of: ${COGNITIVE_OPERATORS.join(", ")}.` });
  }

  const { id } = await context.params;
  const outcome = await runOperator(
    { db: getAppDatabase(), reasoner: new ClaudeSubscriptionReasoner() },
    { objectId: id, operator: operator as CognitiveOperator },
  );

  if (outcome.status === "ok") {
    // `objects` is additive: the result cites ids, and the UI needs their titles to name them.
    return Response.json({
      runId: outcome.run.id,
      operator: outcome.run.operator,
      result: outcome.run.result,
      objects: outcome.packetObjects.map((o) => ({ id: o.id, title: o.title ?? o.content.slice(0, 80) })),
    });
  }
  if (outcome.status === "unavailable") {
    return outcome.reason === "object_not_found"
      ? fail(404, { error: "not_found", message: "No thought with that id." })
      : fail(409, { error: "not_classified", message: "This thought has no house classification yet, so there is no context to reason over." });
  }
  return fail(503, { error: "operator_failed", message: "Couldn't complete this operation. Your thought is safe." });
}
