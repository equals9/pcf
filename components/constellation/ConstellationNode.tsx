import Link from "next/link";
import { HOUSES } from "@/lib/domain/houses";
import type { ConstellationNode as Node } from "@/lib/domain/types";

/** One related object in the constellation (SPEC.md §21). Clicking it makes it the anchor (§25G). */
export function ConstellationNode({ node, href }: { node: Node; href: string }) {
  const house = HOUSES[node.dominantHouse - 1];
  const label = node.object.title ?? node.object.content;
  return (
    <Link href={href} className="constellation__node" aria-label={`${label} — house ${house.number} ${house.name}`}>
      <circle cx={node.x} cy={node.y} r={node.radius} />
    </Link>
  );
}
