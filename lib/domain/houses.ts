import type { HouseNumber, HouseVector } from "./types";

// SPEC.md §12 — Twelve-House Ontology (frozen for v0.1). Semantic coordinates, not folders.
export const HOUSE_NUMBERS: readonly HouseNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export interface HouseDefinition {
  number: HouseNumber;
  name: string;
  domain: string;
}

export const HOUSES: readonly HouseDefinition[] = [
  { number: 1, name: "Self", domain: "identity; self-model; agency; body; personal direction; beginnings; individual perspective" },
  { number: 2, name: "Resources", domain: "values; resources; money; possessions; accumulated knowledge; speech; stored capability" },
  { number: 3, name: "Expression", domain: "communication; writing; learning; skills; experimentation; local discovery; practice through repetition" },
  { number: 4, name: "Foundation", domain: "roots; home; internal state; safety; foundational assumptions; emotional base; underlying structure" },
  { number: 5, name: "Creation", domain: "creativity; invention; play; generativity; ideas; intelligence; expression of originality" },
  { number: 6, name: "Practice", domain: "systems; routine; service; maintenance; problem solving; optimization; workflows; improvement" },
  { number: 7, name: "Relation", domain: "partnership; user; counterparty; exchange; negotiation; opposition; one-to-one relationship" },
  { number: 8, name: "Transformation", domain: "hidden structure; risk; dependencies; deep investigation; transformation; shared resources; failure; unknown mechanisms" },
  { number: 9, name: "Meaning", domain: "philosophy; higher knowledge; frameworks; exploration; research; worldview; teachers; meaning-making" },
  { number: 10, name: "Contribution", domain: "career; public work; execution; responsibility; reputation; achievement; visible contribution" },
  { number: 11, name: "Network", domain: "community; network; collective intelligence; future aims; gains; coordination; many-to-many systems" },
  { number: 12, name: "Beyond", domain: "solitude; subconscious; abstraction; endings; unknown territory; boundary dissolution; retreat; latent material" },
];

/** A house vector with every house set to `value` (default 0). */
export function houseVector(value = 0): HouseVector {
  const v = {} as HouseVector;
  for (const n of HOUSE_NUMBERS) v[n] = value;
  return v;
}
