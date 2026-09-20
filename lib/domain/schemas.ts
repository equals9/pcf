import { z } from "zod";
import { HOUSE_NUMBERS } from "./houses";
import { COGNITIVE_OPERATORS } from "./operators";
import { RELATION_STATUSES, RELATION_TYPES } from "./relations";
import type { HouseVector } from "./types";

// SPEC.md §9 — Zod validation for every persisted domain shape.
// All numeric scores are normalized 0.0 ≤ score ≤ 1.0.

export const scoreSchema = z.number().min(0).max(1);

export const isoTimestampSchema = z.string().min(1);

export const cognitiveObjectTypeSchema = z.enum([
  "thought",
  "idea",
  "question",
  "claim",
  "evidence",
  "belief",
  "decision",
  "experiment",
]);

export const objectStatusSchema = z.enum(["active", "resolved", "dormant", "archived"]);

export const provenanceOriginSchema = z.enum(["user", "ai_inferred", "operator"]);

export const cognitiveObjectSchema = z.object({
  id: z.string().min(1),
  type: cognitiveObjectTypeSchema,
  content: z.string().min(1),
  title: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  lastActivatedAt: isoTimestampSchema.nullable(),
  importance: scoreSchema,
  activation: scoreSchema,
  status: objectStatusSchema,
  provenance: provenanceOriginSchema,
});

export const houseNumberSchema = z.number().int().min(1).max(12);

// Exactly twelve houses, keys 1..12, every score in [0,1]. No extra keys.
export const houseVectorSchema = z
  .object(Object.fromEntries(HOUSE_NUMBERS.map((n) => [String(n), scoreSchema])))
  .strict()
  .transform((v) => v as unknown as HouseVector);

export const conceptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  normalizedName: z.string().min(1),
});

export const relationTypeSchema = z.enum(RELATION_TYPES as [string, ...string[]]);

export const relationStatusSchema = z.enum(RELATION_STATUSES as [string, ...string[]]);

export const relationSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    targetId: z.string().min(1),
    type: relationTypeSchema,
    confidence: scoreSchema,
    rationale: z.string().nullable(),
    origin: provenanceOriginSchema,
    status: relationStatusSchema,
    createdAt: isoTimestampSchema,
  })
  .refine((r) => r.sourceId !== r.targetId, { message: "relation may not link an object to itself", path: ["targetId"] });

export const claimPolaritySchema = z.enum(["positive", "negative", "unknown"]);

export const claimSchema = z.object({
  id: z.string().min(1),
  objectId: z.string().min(1),
  normalizedClaim: z.string().min(1),
  subject: z.string().nullable(),
  predicate: z.string().nullable(),
  objectText: z.string().nullable(),
  polarity: claimPolaritySchema,
  scope: z.string().nullable(),
  confidence: scoreSchema,
  validFrom: isoTimestampSchema.nullable(),
  validTo: isoTimestampSchema.nullable(),
});

export const contradictionClassSchema = z.enum([
  "true_contradiction",
  "partial_tension",
  "scope_difference",
  "temporal_change",
  "supersession",
  "none",
]);

export const contradictionResultSchema = z.object({
  claimAId: z.string().min(1),
  claimBId: z.string().min(1),
  classification: contradictionClassSchema,
  confidence: scoreSchema,
  explanation: z.string().trim().min(1),
  unresolvedQuestion: z.string().trim().min(1).nullable(),
});

export const cognitiveOperatorSchema = z.enum(COGNITIVE_OPERATORS as [string, ...string[]]);

export const feedbackActionSchema = z.enum(["useful", "not_useful", "opened", "saved", "acted_on", "dismissed"]);

export const eventTypeSchema = z.enum([
  "OBJECT_CAPTURED",
  "OBJECT_EXTRACTED",
  "HOUSE_CLASSIFIED",
  "RELATION_PROPOSED",
  "RELATION_ACCEPTED",
  "RELATION_REJECTED",
  "OBJECT_OPENED",
  "OBJECT_RESURFACED",
  "OPERATOR_INVOKED",
  "CONTRADICTION_DETECTED",
  "CONTRADICTION_DISMISSED",
  "FEEDBACK_RECORDED",
]);

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const cognitiveEventSchema = z.object({
  id: z.string().min(1),
  type: eventTypeSchema,
  objectId: z.string().min(1).nullable(),
  payload: jsonObjectSchema,
  createdAt: isoTimestampSchema,
});

export const operatorRunSchema = z.object({
  id: z.string().min(1),
  objectId: z.string().min(1),
  operator: cognitiveOperatorSchema,
  inputContext: jsonObjectSchema,
  result: jsonObjectSchema,
  createdAt: isoTimestampSchema,
});

export const feedbackRecordSchema = z.object({
  id: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  action: feedbackActionSchema,
  createdAt: isoTimestampSchema,
});
