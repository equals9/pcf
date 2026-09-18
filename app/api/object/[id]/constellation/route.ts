import { getAppDatabase } from "../../../../../lib/db/database";
import { buildConstellation } from "../../../../../lib/engine/constellation";
import { isLoopbackRequest } from "../../../../../lib/utils/local-request";

// SPEC.md §26 — GET /api/object/:id/constellation. A thin adapter over the constellation engine:
// no geometry, no ranking and no database writes of its own.

export async function GET(request: Request, context: RouteContext<"/api/object/[id]/constellation">): Promise<Response> {
  if (!isLoopbackRequest(request.headers)) {
    return Response.json({ error: "forbidden", message: "PCF only answers requests addressed to localhost." }, { status: 403 });
  }
  const { id } = await context.params;
  let constellation;
  try {
    constellation = buildConstellation(getAppDatabase(), id);
  } catch (err) {
    console.error(`[pcf constellation] ${JSON.stringify({ operation: "constellation-route", outcome: "failed", errorKind: err instanceof Error ? err.name : typeof err })}`);
    return Response.json({ error: "constellation_failed", message: "The constellation could not be built." }, { status: 500 });
  }
  if (!constellation) {
    return Response.json({ error: "not_found", message: "No object with that id." }, { status: 404 });
  }
  return Response.json(constellation);
}
