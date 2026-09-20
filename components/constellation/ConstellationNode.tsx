import Link from "next/link";
import { HOUSES } from "@/lib/domain/houses";
import type { ConstellationNode as Node } from "@/lib/domain/types";

/**
 * One related object in the constellation (SPEC.md §21). Clicking it makes it the anchor (§25G).
 * The dial is a picture (`role="img"`), so this link is a pointer target only: keyboard and screen-reader
 * users reach the same thought through the text list beneath the dial (§37), where focus is visible.
 */
export function ConstellationNode({ node, href }: { node: Node; href: string }) {
  const house = HOUSES[node.dominantHouse - 1];
  const label = node.object.title ?? node.object.content;
  return (
    <Link href={href} className="constellation__node" tabIndex={-1} aria-label={`${label} — house ${house.number} ${house.name}`}>
      <circle cx={node.x} cy={node.y} r={node.radius} />
    </Link>
  );
}
