import Link from "next/link";
import { ConstellationEdge } from "./ConstellationEdge";
import { ConstellationNode } from "./ConstellationNode";
import { CONSTELLATION_CENTER, CONSTELLATION_SIZE, MIN_ORBIT_RADIUS, ORBIT_RADIUS_SPAN, SECTOR_DEGREES, type Constellation } from "@/lib/engine/constellation";
import { HOUSES } from "@/lib/domain/houses";

const OUTER_RADIUS = MIN_ORBIT_RADIUS + ORBIT_RADIUS_SPAN;
const ANCHOR_RADIUS = 6;

const spoke = (index: number) => {
  const angle = ((-90 + index * SECTOR_DEGREES - SECTOR_DEGREES / 2) * Math.PI) / 180;
  return { x: CONSTELLATION_CENTER + OUTER_RADIUS * Math.cos(angle), y: CONSTELLATION_CENTER + OUTER_RADIUS * Math.sin(angle) };
};

/**
 * The twelve-sector dial with the anchor at the centre (SPEC.md §21, §25G).
 * Deterministic geometry only: every position comes from the engine.
 */
export function ConstellationGraph({ constellation, hrefFor }: { constellation: Constellation; hrefFor: (id: string) => string }) {
  const { anchor, nodes, edges } = constellation;
  const points = new Map(nodes.map((n) => [n.object.id, { x: n.x, y: n.y }]));
  points.set(anchor.id, { x: CONSTELLATION_CENTER, y: CONSTELLATION_CENTER });
  const anchorLabel = anchor.title ?? anchor.content;

  return (
    <>
      <svg
        className="constellation__svg"
        viewBox={`0 0 ${CONSTELLATION_SIZE} ${CONSTELLATION_SIZE}`}
        role="img"
        aria-label={`Constellation around ${anchorLabel}: ${nodes.length} related ${nodes.length === 1 ? "thought" : "thoughts"}.`}
      >
        <circle cx={CONSTELLATION_CENTER} cy={CONSTELLATION_CENTER} r={OUTER_RADIUS} className="constellation__ring" />
        <circle cx={CONSTELLATION_CENTER} cy={CONSTELLATION_CENTER} r={MIN_ORBIT_RADIUS} className="constellation__ring constellation__ring--inner" />
        {HOUSES.map((house, index) => {
          const end = spoke(index);
          return <line key={house.number} className="constellation__spoke" x1={CONSTELLATION_CENTER} y1={CONSTELLATION_CENTER} x2={end.x} y2={end.y} />;
        })}
        {edges.map((edge, index) => {
          const from = points.get(edge.sourceId);
          const to = points.get(edge.targetId);
          return from && to ? <ConstellationEdge key={`${edge.sourceId}-${edge.targetId}-${index}`} edge={edge} from={from} to={to} /> : null;
        })}
        <circle className="constellation__anchor" cx={CONSTELLATION_CENTER} cy={CONSTELLATION_CENTER} r={ANCHOR_RADIUS} />
        {nodes.map((node) => (
          <ConstellationNode key={node.object.id} node={node} href={hrefFor(node.object.id)} />
        ))}
      </svg>
      {/* SPEC §37: the same information without the picture. */}
      <p className="constellation__anchor-label">
        <span className="constellation__anchor-name">{anchorLabel}</span>
      </p>
      <ol className="constellation__list">
        {nodes.map((node) => (
          <li key={node.object.id}>
            <Link href={hrefFor(node.object.id)}>{node.object.title ?? node.object.content}</Link>{" "}
            <span className="constellation__list-house">
              {node.dominantHouse} · {HOUSES[node.dominantHouse - 1].name}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
