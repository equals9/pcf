import { openDatabase, type PcfDatabase } from "../../lib/db/database";
import { runMigrations } from "../../lib/db/migrations";
import type { CaptureDeps, CaptureLogEntry } from "../../lib/engine/capture";
import type { Reasoner } from "../../lib/ai/reasoner";
import { HOUSE_NUMBERS } from "../../lib/domain/houses";
import type { InferRelationsPromptInput } from "../../lib/ai/prompts/infer-relations";

// Deterministic fixtures for the Phase 3 capture pipeline. No private data.

/** SPEC §32 capture-test text. */
export const SPEC_CAPTURE_TEXT = "Maybe persistent AI memory should remain outside model weights";

export const EXTRACTION = {
  type: "idea",
  title: "Persistent AI memory outside model weights",
  concepts: [{ name: "AI memory" }, { name: "Model weights" }, { name: "persistence" }],
  claims: [
    {
      normalizedClaim: "persistent AI memory should remain outside model weights",
      subject: "persistent AI memory",
      predicate: "should remain outside",
      objectText: "model weights",
      polarity: "positive",
      scope: null,
      confidence: 0.6,
    },
  ],
  unresolved: true,
  importanceEstimate: 0.7,
};

/** House classifier output with the given peaks (others 0.05) and dominant houses. */
export function housesOutput(peaks: Record<number, number>, dominantHouses: number[], rationale = "Mostly about stored capability.") {
  const scores: Record<string, number> = {};
  for (const n of HOUSE_NUMBERS) scores[String(n)] = peaks[n] ?? 0.05;
  return { scores, dominantHouses, rationale };
}

export const HOUSES = housesOutput({ 2: 0.8, 4: 0.5, 5: 0.6, 8: 0.4 }, [2, 5]);

export function newTestDb(file: string = ":memory:"): PcfDatabase {
  const db = openDatabase(file);
  runMigrations(db);
  return db;
}

/** A clock that starts at a fixed instant and advances one second per reading. */
export function steppingClock(startIso = "2026-09-16T12:00:00.000Z"): () => Date {
  let t = Date.parse(startIso);
  return () => {
    const d = new Date(t);
    t += 1000;
    return d;
  };
}

export function captureDeps(db: PcfDatabase, reasoner: Reasoner, logs: CaptureLogEntry[] = []): CaptureDeps {
  return { db, reasoner, now: steppingClock(), log: (e) => logs.push(e) };
}

export function parseRelationPrompt(prompt: string): InferRelationsPromptInput {
  return JSON.parse(prompt.slice(prompt.indexOf("{"))) as InferRelationsPromptInput;
}

export function count(db: PcfDatabase, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}
