import { ConstellationGraph } from "./ConstellationGraph";
import { CONSTELLATION_CENTER, CONSTELLATION_SIZE, MIN_ORBIT_RADIUS, ORBIT_RADIUS_SPAN, SECTOR_DEGREES, type Constellation } from "@/lib/engine/constellation";

const OUTER_RADIUS = MIN_ORBIT_RADIUS + ORBIT_RADIUS_SPAN;

/**
 * Contextual constellation pane (SPEC.md §25G). The anchor is the selected object, otherwise the latest
 * object today. With no anchor it shows an empty astrolabe-like scaffold and no fake nodes.
 */
export function ConstellationPane({ constellation, hrefFor }: { constellation: Constellation | null; hrefFor: (id: string) => string }) {
  return (
    <aside className="constellation" aria-label="Constellation">
      <h2 className="constellation__title">Constellation</h2>
      {constellation ? (
        <ConstellationGraph constellation={constellation} hrefFor={hrefFor} />
      ) : (
        <svg
          className="constellation__svg"
          viewBox={`0 0 ${CONSTELLATION_SIZE} ${CONSTELLATION_SIZE}`}
          role="img"
          aria-label="Empty constellation."
        >
          <circle cx={CONSTELLATION_CENTER} cy={CONSTELLATION_CENTER} r={OUTER_RADIUS} className="constellation__ring" />
          <circle cx={CONSTELLATION_CENTER} cy={CONSTELLATION_CENTER} r={MIN_ORBIT_RADIUS} className="constellation__ring constellation__ring--inner" />
          {Array.from({ length: 12 }, (_, index) => {
            const angle = ((-90 + index * SECTOR_DEGREES - SECTOR_DEGREES / 2) * Math.PI) / 180;
            return (
              <line
                key={index}
                className="constellation__spoke"
                x1={CONSTELLATION_CENTER}
                y1={CONSTELLATION_CENTER}
                x2={CONSTELLATION_CENTER + OUTER_RADIUS * Math.cos(angle)}
                y2={CONSTELLATION_CENTER + OUTER_RADIUS * Math.sin(angle)}
              />
            );
          })}
          <circle className="constellation__anchor constellation__anchor--empty" cx={CONSTELLATION_CENTER} cy={CONSTELLATION_CENTER} r={4} />
        </svg>
      )}
    </aside>
  );
}
