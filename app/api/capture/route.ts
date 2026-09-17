import { ClaudeSubscriptionReasoner } from "../../../lib/ai/claude-subscription";
import { getAppDatabase } from "../../../lib/db/database";
import { CaptureAfterSaveError, CaptureValidationError, captureThought } from "../../../lib/engine/capture";
import { isLoopbackRequest } from "../../../lib/utils/local-request";

// SPEC.md §26 — POST /api/capture. A thin adapter over the capture engine: all AI work happens in
// `captureThought`, which commits the raw thought before any reasoner call. The response is sent once the
// pipeline finishes. If the client disconnects, the pipeline still runs to completion and the stored thought
// stays stored.

/** Error body. `saved` says whether the thought is stored. */
export interface CaptureErrorBody {
  error: "forbidden" | "invalid_request" | "unsupported_media_type" | "capture_not_saved" | "capture_saved_incomplete";
  message: string;
  saved: boolean;
  objectId?: string;
}

const SHAPE_MESSAGE = 'Send {"content": "..."} with non-empty text.';

function fail(status: number, body: CaptureErrorBody): Response {
  return Response.json(body, { status });
}

function logFailure(outcome: string, err: unknown, objectId?: string): void {
  // SPEC §29: operation, outcome, error type and object id only. Never content.
  const errorKind = err instanceof Error ? err.name : typeof err;
  console.error(`[pcf capture] ${JSON.stringify({ operation: "capture-route", outcome, errorKind, objectId })}`);
}

export async function POST(request: Request): Promise<Response> {
  if (!isLoopbackRequest(request.headers)) {
    return fail(403, { error: "forbidden", message: "PCF only accepts captures addressed to localhost.", saved: false });
  }
  // Requiring JSON makes a cross-site browser request need a CORS preflight, which this route never grants.
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType)) {
    return fail(415, { error: "unsupported_media_type", message: "Send the capture as application/json.", saved: false });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, { error: "invalid_request", message: "The request body is not valid JSON.", saved: false });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(400, { error: "invalid_request", message: SHAPE_MESSAGE, saved: false });
  }

  try {
    const result = await captureThought({ db: getAppDatabase(), reasoner: new ClaudeSubscriptionReasoner() }, (body as { content?: unknown }).content);
    return Response.json(result);
  } catch (err) {
    if (err instanceof CaptureValidationError) {
      return fail(400, { error: "invalid_request", message: SHAPE_MESSAGE, saved: false });
    }
    if (err instanceof CaptureAfterSaveError) {
      logFailure("saved_incomplete", err.cause, err.objectId);
      return fail(500, {
        error: "capture_saved_incomplete",
        message: "Your thought was saved, but the capture could not finish.",
        saved: true,
        objectId: err.objectId,
      });
    }
    logFailure("not_saved", err);
    return fail(500, { error: "capture_not_saved", message: "Your thought could not be saved.", saved: false });
  }
}
