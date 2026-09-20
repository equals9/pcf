import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DateHeader } from "./DateHeader";
import { CaptureBox } from "./CaptureBox";
import { ResurfacedCard } from "./ResurfacedCard";
import { TensionCard } from "./TensionCard";
import { ThoughtStream, type StreamItem } from "./ThoughtStream";
import { ConstellationPane } from "@/components/constellation/ConstellationPane";
import { getAppDatabase } from "@/lib/db/database";
import { getHouseScores, getObject, listObjectsCreatedBetween } from "@/lib/db/repositories/objects";
import { dominantHouse } from "@/lib/domain/houses";
import { buildConstellation } from "@/lib/engine/constellation";
import { currentTension } from "@/lib/engine/contradiction";
import { resurfaceForToday } from "@/lib/engine/resurfacing";
import { isLoopbackRequest } from "@/lib/utils/local-request";
import { localDayBounds } from "@/lib/utils/time";

/** The selected object travels in the URL, so every view of Today is shareable and server-rendered. */
export const FOCUS_PARAM = "focus";

/** Today is the only primary surface (SPEC.md §25). It reads local state on every request. */
export async function TodayView({ focusId }: { focusId?: string }) {
  await connection();
  // Local thoughts are shown only to requests addressed to this machine (see lib/utils/local-request.ts).
  if (!isLoopbackRequest(await headers())) notFound();
  const db = getAppDatabase();
  const { start, end } = localDayBounds();
  const today = listObjectsCreatedBetween(db, start, end);
  const items: StreamItem[] = today.map((object) => {
    const houses = getHouseScores(db, object.id);
    return { object, dominantHouse: houses ? dominantHouse(houses) : null };
  });

  // §25G: the selected object anchors the constellation; with none selected, the latest object today.
  const selected = focusId ? getObject(db, focusId) : null;
  const anchorId = selected?.id ?? today[0]?.id ?? null;
  const constellation = anchorId ? buildConstellation(db, anchorId) : null;
  const hrefFor = (id: string) => `/?${FOCUS_PARAM}=${encodeURIComponent(id)}`;

  // §22 and §25F: at most one returned thought and at most one unresolved tension, both from canonical
  // state. Resurfacing is deterministic; the tension replays verdicts already recorded as events.
  const resurfaced = resurfaceForToday(db);
  const tension = currentTension(db);

  return (
    <main className="today">
      <DateHeader />
      <div className="today__body">
        <section className="today__stream" aria-label="Today">
          <CaptureBox />
          <ThoughtStream items={items} selectedId={anchorId} hrefFor={hrefFor} />
          {resurfaced && (
            // Keyed by the thought: a different thought is a different card, so its recorded/failed state resets.
            <ResurfacedCard
              key={resurfaced.object.id}
              resurfaced={{ object: resurfaced.object, why: resurfaced.why, ageDays: resurfaced.ageDays }}
              href={hrefFor(resurfaced.object.id)}
            />
          )}
          {tension && <TensionCard key={`${tension.claimA.id}:${tension.claimB.id}`} tension={tension} />}
        </section>
        <ConstellationPane constellation={constellation} hrefFor={hrefFor} />
      </div>
    </main>
  );
}
