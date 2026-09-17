import { HOUSES } from "@/lib/domain/houses";
import type { CognitiveObject, HouseNumber } from "@/lib/domain/types";

/**
 * One thought in the Today stream (SPEC.md §25C): time, title, content preview and dominant house.
 * The four operator buttons arrive with the operators (Phase 5).
 */
export function ThoughtCard({ object, dominantHouse }: { object: CognitiveObject; dominantHouse: HouseNumber | null }) {
  const time = new Date(object.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const house = dominantHouse === null ? null : HOUSES[dominantHouse - 1];
  return (
    <article className="thought">
      <p className="thought__meta">
        <time dateTime={object.createdAt}>{time}</time>
        {house && (
          <span className="thought__house">
            <span className="visually-hidden">Dominant house: </span>
            {house.number} · {house.name}
          </span>
        )}
      </p>
      {object.title && <h3 className="thought__title">{object.title}</h3>}
      <p className="thought__preview">{object.content}</p>
    </article>
  );
}
