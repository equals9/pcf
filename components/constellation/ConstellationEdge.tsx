import type { ConstellationEdge as Edge } from "@/lib/domain/types";

export interface EdgePoint {
  x: number;
  y: number;
}

/** A persisted relation between two visible objects (SPEC.md §21). Restrained by design: one thin line. */
export function ConstellationEdge({ edge, from, to }: { edge: Edge; from: EdgePoint; to: EdgePoint }) {
  return <line className="constellation__edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeOpacity={0.25 + edge.confidence * 0.35} />;
}
