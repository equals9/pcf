import { ClaudeSubscriptionReasoner } from "../../../lib/ai/claude-subscription";
import { getAppDatabase } from "../../../lib/db/database";
import { listObjectsCreatedBetween } from "../../../lib/db/repositories/objects";
import { currentTension, detectContradictions, pendingCheckObjectId } from "../../../lib/engine/contradiction";
import { resurfaceForToday } from "../../../lib/engine/resurfacing";
import { isLoopbackRequest } from "../../../lib/utils/local-request";
import { localDateString, localDayBounds } from "../../../lib/utils/time";

// SPEC.md §26 — GET /api/today. It returns today's state and owns the one place where §24 contradiction
// detection runs: at most one object is classified per request, and only if its claims have never been
// checked. Everything else here is a read.

export interface TodayErrorBody {
  error: "forbidden" | "today_failed";
  message: string;
}

/**
 * A cross-site GET made by markup — <img>, <script>, <link rel=prefetch>, an iframe — carries no Origin, so
 * the loopback check alone would let it through and it would spend a Claude call. Fetch metadata says where
 * the request came from: anything that is not this app's own fetch or a direct address-bar visit is refused.
 */
function fromThisApp(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const dest = request.headers.get("sec-fetch-dest");
  if (site !== null && site !== "same-origin" && site !== "none") return false;
  return dest === null || dest === "empty" || dest === "document";
}

export async function GET(request: Request): Promise<Response> {
  if (!isLoopbackRequest(request.headers) || !fromThisApp(request)) {
    return Response.json({ error: "forbidden", message: "PCF only answers requests addressed to localhost." } satisfies TodayErrorBody, { status: 403 });
  }

  try {
    const db = getAppDatabase();
    const now = new Date();
    const { start, end } = localDayBounds(now);
    const objects = listObjectsCreatedBetween(db, start, end);

    // §24 runs on the newest unchecked object with claims, newest first, one per request.
    const pending = pendingCheckObjectId(db, objects.map((object) => object.id));
    if (pending) {
      await detectContradictions({ db, reasoner: new ClaudeSubscriptionReasoner() }, pending);
    }

    const resurfaced = resurfaceForToday(db, now);
    return Response.json({
      date: localDateString(now),
      objects,
      resurfaced: resurfaced ? { ...resurfaced.object, why: resurfaced.why, ageDays: resurfaced.ageDays } : null,
      tension: currentTension(db)?.result ?? null,
      checked: pending,
    });
  } catch (err) {
    console.error(`[pcf today] ${JSON.stringify({ operation: "today-route", outcome: "failed", errorKind: err instanceof Error ? err.name : typeof err })}`);
    return Response.json({ error: "today_failed", message: "Today could not be read." } satisfies TodayErrorBody, { status: 500 });
  }
}
