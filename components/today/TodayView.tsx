import { DateHeader } from "./DateHeader";
import { CaptureBox } from "./CaptureBox";
import { ConstellationPane } from "@/components/constellation/ConstellationPane";

/** Today is the only primary surface (SPEC.md §25). Phase 0 renders the static shell. */
export function TodayView() {
  return (
    <main className="today">
      <DateHeader />
      <div className="today__body">
        <section className="today__stream" aria-label="Today">
          <CaptureBox />
          <h2 className="stream__heading">Today&apos;s thoughts</h2>
          <p className="stream__empty">Nothing captured yet.</p>
        </section>
        <ConstellationPane />
      </div>
    </main>
  );
}
