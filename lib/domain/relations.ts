import type { RelationStatus, RelationType } from "./types";

// SPEC.md §9 — typed relation vocabulary (frozen).
export const RELATION_TYPES: readonly RelationType[] = [
  "supports",
  "contradicts",
  "depends_on",
  "causes",
  "derived_from",
  "analogous_to",
  "contains",
  "requires",
  "answers",
  "questions",
  "extends",
  "supersedes",
  "related_to",
];

export const RELATION_STATUSES: readonly RelationStatus[] = ["proposed", "accepted", "rejected"];
