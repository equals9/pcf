import { ThoughtCard } from "./ThoughtCard";
import type { CognitiveObject, HouseNumber } from "@/lib/domain/types";

export interface StreamItem {
  object: CognitiveObject;
  dominantHouse: HouseNumber | null;
}

/** Today's objects only, newest first (SPEC.md §25C). */
export function ThoughtStream({
  items,
  selectedId,
  hrefFor,
}: {
  items: StreamItem[];
  selectedId: string | null;
  hrefFor: (id: string) => string;
}) {
  return (
    <section className="stream" aria-labelledby="stream-heading">
      <h2 id="stream-heading" className="stream__heading">
        Today&apos;s thoughts
      </h2>
      {items.length === 0 ? (
        <p className="stream__empty">Nothing captured yet.</p>
      ) : (
        <ol className="stream__list" aria-labelledby="stream-heading">
          {items.map(({ object, dominantHouse }) => (
            <li key={object.id}>
              <ThoughtCard object={object} dominantHouse={dominantHouse} href={hrefFor(object.id)} selected={object.id === selectedId} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
