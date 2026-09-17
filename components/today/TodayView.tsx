import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DateHeader } from "./DateHeader";
import { CaptureBox } from "./CaptureBox";
import { ThoughtStream, type StreamItem } from "./ThoughtStream";
import { ConstellationPane } from "@/components/constellation/ConstellationPane";
import { getAppDatabase } from "@/lib/db/database";
import { getHouseScores, listObjectsCreatedBetween } from "@/lib/db/repositories/objects";
import { dominantHouse } from "@/lib/domain/houses";
import { isLoopbackRequest } from "@/lib/utils/local-request";
import { localDayBounds } from "@/lib/utils/time";

/** Today is the only primary surface (SPEC.md §25). It reads local state on every request. */
export async function TodayView() {
  await connection();
  // Local thoughts are shown only to requests addressed to this machine (see lib/utils/local-request.ts).
  if (!isLoopbackRequest(await headers())) notFound();
  const db = getAppDatabase();
  const { start, end } = localDayBounds();
  const items: StreamItem[] = listObjectsCreatedBetween(db, start, end).map((object) => {
    const houses = getHouseScores(db, object.id);
    return { object, dominantHouse: houses ? dominantHouse(houses) : null };
  });

  return (
    <main className="today">
      <DateHeader />
      <div className="today__body">
        <section className="today__stream" aria-label="Today">
          <CaptureBox />
          <ThoughtStream items={items} />
        </section>
        <ConstellationPane />
      </div>
    </main>
  );
}
