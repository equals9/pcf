// SPEC.md §9 — TypeScript domain types (frozen).

export type CognitiveObjectType =
  | "thought"
  | "idea"
  | "question"
  | "claim"
  | "evidence"
  | "belief"
  | "decision"
  | "experiment";

export type ObjectStatus = "active" | "resolved" | "dormant" | "archived";

export type ProvenanceOrigin = "user" | "ai_inferred" | "operator";

export interface CognitiveObject {
  id: string;
  type: CognitiveObjectType;
  content: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivatedAt: string | null;
  importance: number;
  activation: number;
  status: ObjectStatus;
  provenance: ProvenanceOrigin;
}

export type HouseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type HouseVector = Record<HouseNumber, number>;

export interface Concept {
  id: string;
  name: string;
  normalizedName: string;
}

export type RelationType =
  | "supports"
  | "contradicts"
  | "depends_on"
  | "causes"
  | "derived_from"
  | "analogous_to"
  | "contains"
  | "requires"
  | "answers"
  | "questions"
  | "extends"
  | "supersedes"
  | "related_to";

export type RelationStatus = "proposed" | "accepted" | "rejected";

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  confidence: number;
  rationale: string | null;
  origin: ProvenanceOrigin;
  status: RelationStatus;
  createdAt: string;
}

export type ClaimPolarity = "positive" | "negative" | "unknown";

export interface Claim {
  id: string;
  objectId: string;
  normalizedClaim: string;
  subject: string | null;
  predicate: string | null;
  objectText: string | null;
  polarity: ClaimPolarity;
  scope: string | null;
  confidence: number;
  validFrom: string | null;
  validTo: string | null;
}

export type CognitiveOperator = "mercury_connect" | "jupiter_expand" | "saturn_challenge" | "mars_act";

export type FeedbackAction = "useful" | "not_useful" | "opened" | "saved" | "acted_on" | "dismissed";

export interface ConstellationNode {
  object: CognitiveObject;
  relevance: number;
  dominantHouse: HouseNumber;
  x: number;
  y: number;
  radius: number;
}

export interface ConstellationEdge {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence: number;
}

// SPEC.md §24 — contradiction detection over claim pairs.
export type ContradictionClass =
  | "true_contradiction"
  | "partial_tension"
  | "scope_difference"
  | "temporal_change"
  | "supersession"
  | "none";

export interface ContradictionResult {
  claimAId: string;
  claimBId: string;
  classification: ContradictionClass;
  confidence: number;
  explanation: string;
  unresolvedQuestion: string | null;
}

// SPEC.md §11 — append-only event types.
export type EventType =
  | "OBJECT_CAPTURED"
  | "OBJECT_EXTRACTED"
  | "HOUSE_CLASSIFIED"
  | "RELATION_PROPOSED"
  | "RELATION_ACCEPTED"
  | "RELATION_REJECTED"
  | "OBJECT_OPENED"
  | "OBJECT_RESURFACED"
  | "OPERATOR_INVOKED"
  | "CONTRADICTION_DETECTED"
  | "CONTRADICTION_DISMISSED"
  | "FEEDBACK_RECORDED";

// Persistence records for tables whose row shape SPEC §9 does not name (§10 defines the columns).
export interface CognitiveEvent {
  id: string;
  type: EventType;
  objectId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OperatorRun {
  id: string;
  objectId: string;
  operator: CognitiveOperator;
  inputContext: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string;
}

export interface FeedbackRecord {
  id: string;
  targetType: string;
  targetId: string;
  action: FeedbackAction;
  createdAt: string;
}
