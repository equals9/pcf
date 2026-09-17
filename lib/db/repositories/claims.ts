import type { PcfDatabase } from "../database";
import { claimSchema } from "../../domain/schemas";
import type { Claim } from "../../domain/types";

interface ClaimRow {
  id: string;
  object_id: string;
  normalized_claim: string;
  subject: string | null;
  predicate: string | null;
  object_text: string | null;
  polarity: string;
  scope: string | null;
  confidence: number;
  valid_from: string | null;
  valid_to: string | null;
}

function rowToClaim(r: ClaimRow): Claim {
  return {
    id: r.id,
    objectId: r.object_id,
    normalizedClaim: r.normalized_claim,
    subject: r.subject,
    predicate: r.predicate,
    objectText: r.object_text,
    polarity: r.polarity as Claim["polarity"],
    scope: r.scope,
    confidence: r.confidence,
    validFrom: r.valid_from,
    validTo: r.valid_to,
  };
}

export function insertClaim(db: PcfDatabase, input: Claim, createdAt: string): Claim {
  const c = claimSchema.parse(input);
  db.prepare(
    `INSERT INTO claims (id, object_id, normalized_claim, subject, predicate, object_text, polarity, scope, confidence, valid_from, valid_to, created_at)
     VALUES (@id, @objectId, @normalizedClaim, @subject, @predicate, @objectText, @polarity, @scope, @confidence, @validFrom, @validTo, @createdAt)`,
  ).run({ ...c, createdAt });
  return c;
}

export function listClaimsForObject(db: PcfDatabase, objectId: string): Claim[] {
  const rows = db.prepare("SELECT * FROM claims WHERE object_id = ? ORDER BY created_at, id").all(objectId) as ClaimRow[];
  return rows.map(rowToClaim);
}

/** Every claim in the store, oldest first. */
export function listAllClaims(db: PcfDatabase): Claim[] {
  const rows = db.prepare("SELECT * FROM claims ORDER BY created_at, id").all() as ClaimRow[];
  return rows.map(rowToClaim);
}
