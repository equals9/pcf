import Link from "next/link";
import { HOUSES } from "@/lib/domain/houses";
import type { CognitiveObject, HouseNumber } from "@/lib/domain/types";

/**
 * One thought in the Today stream (SPEC.md §25C): time, title, content preview and dominant house.
 * Selecting a card makes it the constellation anchor (§25G). The four operator buttons arrive in Phase 5.
 */
export function ThoughtCard({
  object,
  dominantHouse,
  href,
  selected,
}: {
  object: CognitiveObject;
  dominantHouse: HouseNumber | null;
  href: string;
  selected: boolean;
}) {
  const time = new Date(object.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const house = dominantHouse === null ? null : HOUSES[dominantHouse - 1];
  return (
    <article className={selected ? "thought thought--selected" : "thought"}>
      <p className="thought__meta">
        <time dateTime={object.createdAt}>{time}</time>
        {house && (
          <span className="thought__house">
            <span className="visually-hidden">Dominant house: </span>
            {house.number} · {house.name}
          </span>
        )}
        {selected && <span className="thought__selected">In the constellation centre</span>}
      </p>
      <Link href={href} className="thought__link" aria-current={selected ? "true" : undefined}>
        {object.title ? <h3 className="thought__title">{object.title}</h3> : <span className="visually-hidden">Focus this thought</span>}
        <span className="thought__preview">{object.content}</span>
      </Link>
    </article>
  );
}
