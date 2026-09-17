import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeSubscriptionReasoner, type ProcessRequest, type ProcessResult } from "../../lib/ai/claude-subscription";
import { CLASSIFY_HOUSES_SYSTEM } from "../../lib/ai/prompts/classify-houses";
import { INFER_RELATIONS_SYSTEM } from "../../lib/ai/prompts/infer-relations";
import { EXTRACT_SYSTEM } from "../../lib/ai/prompts/extract";
import { ReasonerError } from "../../lib/ai/reasoner";
import { openDatabase, type PcfDatabase } from "../../lib/db/database";
import { listClaimsForObject } from "../../lib/db/repositories/claims";
import { listConceptsForObject } from "../../lib/db/repositories/concepts";
import { appendEvent, listEvents } from "../../lib/db/repositories/events";
import { getHouseScores, getObject, listObjects } from "../../lib/db/repositories/objects";
import { listRelationsForObject } from "../../lib/db/repositories/relations";
import { HOUSE_NUMBERS } from "../../lib/domain/houses";
import {
  CaptureAfterSaveError,
  CaptureValidationError,
  captureThought,
  isExtractionComplete,
  persistRawCapture,
  retryIncompleteCapture,
  type CaptureLogEntry,
} from "../../lib/engine/capture";
import { fallbackHouseVector } from "../../lib/engine/house-classifier";
import { CANDIDATE_CONTENT_CHARS, MAX_RELATION_CANDIDATES } from "../../lib/engine/relation-inference";
import { seedDemo } from "../../scripts/seed-demo";
import {
  EXTRACTION,
  HOUSES,
  SPEC_CAPTURE_TEXT,
  captureDeps,
  count,
  housesOutput,
  newTestDb,
  parseRelationPrompt,
} from "../fixtures/capture-fixtures";
import { MockReasoner, type MockResponse } from "../fixtures/mock-reasoner";

const FALLBACK = fallbackHouseVector();
const vectorOf = (out: { scores: Record<string, number> }) => Object.fromEntries(HOUSE_NUMBERS.map((n) => [n, out.scores[String(n)]]));
const eventTypes = (db: PcfDatabase, objectId: string) => listEvents(db, { objectId }).map((e) => e.type);
const tasks = (m: MockReasoner) => m.calls.map((c) => c.task);
const noProposals = { proposals: [] };

function mock(responses: Record<string, MockResponse>, unavailable = false) {
  return new MockReasoner({ responses, unavailable });
}

function failing(kind: "invalid_output" | "unavailable" | "timeout") {
  return () => {
    throw new ReasonerError(kind, "test", `simulated ${kind}`);
  };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pcf-capture-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("successful capture (SPEC §32 capture test)", () => {
  it("produces one object, 12 house rows, concepts, claims and the three events", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);

    expect(listObjects(db)).toHaveLength(1);
    expect(count(db, "house_scores")).toBe(12);
    expect(result.concepts.length).toBeGreaterThanOrEqual(1);
    expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED"]);

    expect(result.object).toMatchObject({
      content: SPEC_CAPTURE_TEXT,
      type: "idea",
      title: EXTRACTION.title,
      importance: 0.7,
      activation: 0.5,
      status: "active",
      provenance: "user",
    });
    expect(result.houseVector).toEqual(vectorOf(HOUSES));
    expect(getHouseScores(db, result.object.id)).toEqual(vectorOf(HOUSES));
    expect(result.concepts.map((c) => c.normalizedName).sort()).toEqual(["ai memory", "model weights", "persistence"]);
    expect(listClaimsForObject(db, result.object.id)).toEqual([
      expect.objectContaining({ ...EXTRACTION.claims[0], objectId: result.object.id, validFrom: null, validTo: null }),
    ]);
    expect(result.relations).toEqual([]);
    expect(result.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "none" });
    expect(isExtractionComplete(db, result.object.id)).toBe(true);

    const extracted = listEvents(db, { type: "OBJECT_EXTRACTED" })[0];
    expect(extracted.payload).toMatchObject({ objectType: "idea", unresolved: true, importanceEstimate: 0.7 });
    const classified = listEvents(db, { type: "HOUSE_CLASSIFIED" })[0];
    expect(classified.payload).toMatchObject({ source: "model", dominantHouses: [2, 5] });
  });

  it("makes exactly one extraction call and one classification call when there are no candidates", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(tasks(reasoner)).toEqual(["extract", "classify-houses"]);
  });

  it("stores the text exactly as typed and sends the classifier the extracted title and concepts", async () => {
    const db = newTestDb();
    const typed = "  Maybe memory is\nreconstructable state-transition history.  \n";
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    const { object } = await captureThought(captureDeps(db, reasoner), typed);
    expect(getObject(db, object.id)!.content).toBe(typed);
    expect(reasoner.calls[0].prompt).toContain(JSON.stringify(typed));
    const housesPrompt = reasoner.calls[1].prompt;
    expect(housesPrompt).toContain(EXTRACTION.title);
    for (const name of ["AI memory", "Model weights", "persistence"]) expect(housesPrompt).toContain(name);
    for (const call of reasoner.calls) expect(call.system).not.toContain("reconstructable");
  });

  it("stores concepts that normalize to the same name once", async () => {
    const db = newTestDb();
    const duplicates = { ...EXTRACTION, concepts: [{ name: "AI memory" }, { name: "  ai   MEMORY " }, { name: "Retrieval" }] };
    const result = await captureThought(captureDeps(db, mock({ extract: duplicates, "classify-houses": HOUSES })), SPEC_CAPTURE_TEXT);
    expect(result.concepts.map((c) => c.normalizedName)).toEqual(["ai memory", "retrieval"]);
    expect(count(db, "concepts")).toBe(2);
    expect(count(db, "object_concepts")).toBe(2);
    const payload = listEvents(db, { type: "OBJECT_EXTRACTED" })[0].payload as { conceptIds: string[] };
    expect(payload.conceptIds).toHaveLength(2);
    expect(new Set(payload.conceptIds).size).toBe(2);
  });

  it("survives a restart (SPEC §32 persistence test)", async () => {
    const file = join(dir, "pcf.db");
    const db1 = newTestDb(file);
    const { object } = await captureThought(captureDeps(db1, mock({ extract: EXTRACTION, "classify-houses": HOUSES })), SPEC_CAPTURE_TEXT);
    db1.close();

    const db2 = openDatabase(file);
    expect(getObject(db2, object.id)).toMatchObject({ content: SPEC_CAPTURE_TEXT, type: "idea" });
    expect(getHouseScores(db2, object.id)).toEqual(vectorOf(HOUSES));
    expect(listConceptsForObject(db2, object.id)).toHaveLength(3);
    expect(eventTypes(db2, object.id)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED"]);
    db2.close();
  });
});

describe("raw-first persistence", () => {
  it("commits the raw object and OBJECT_CAPTURED before the first reasoner call", async () => {
    const file = join(dir, "pcf.db");
    const db = newTestDb(file);
    let seenByOtherConnection: unknown;
    const reasoner = mock({
      extract: () => {
        const other = openDatabase(file);
        try {
          const [obj] = listObjects(other);
          seenByOtherConnection = { obj, events: listEvents(other).map((e) => e.type), houses: count(other, "house_scores") };
        } finally {
          other.close();
        }
        throw new ReasonerError("unavailable", "extract", "simulated outage");
      },
    });
    const { object } = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(seenByOtherConnection).toEqual({
      obj: expect.objectContaining({ id: object.id, content: SPEC_CAPTURE_TEXT, type: "thought", title: null, provenance: "user" }),
      events: ["OBJECT_CAPTURED"],
      houses: 0,
    });
    db.close();
  });

  it("stores nothing, and calls no reasoner, when the raw capture cannot be committed", async () => {
    const db = newTestDb();
    db.exec("CREATE TRIGGER no_events BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'test: events unavailable'); END;");
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    await expect(captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT)).rejects.toThrow(/events unavailable/);
    expect(count(db, "objects")).toBe(0);
    expect(reasoner.calls).toEqual([]);
  });

  it("reports a failure after the raw commit as CaptureAfterSaveError, with the stored object's id", async () => {
    const db = newTestDb();
    const reasoner = mock({
      extract: EXTRACTION,
      "classify-houses": () => {
        // The result cannot be read back once the relations table is gone.
        db.exec("DROP TABLE relations");
        return HOUSES;
      },
    });
    const error = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CaptureAfterSaveError);
    const [stored] = listObjects(db);
    expect((error as CaptureAfterSaveError).objectId).toBe(stored.id);
    expect(stored).toMatchObject({ content: SPEC_CAPTURE_TEXT, title: EXTRACTION.title });
    expect(listEvents(db).map((e) => e.type)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED"]);
  });

  it("does not report a failed raw commit as CaptureAfterSaveError", async () => {
    const db = newTestDb();
    db.exec("CREATE TRIGGER no_objects BEFORE INSERT ON objects BEGIN SELECT RAISE(ABORT, 'test: objects unavailable'); END;");
    const error = await captureThought(captureDeps(db, mock({})), SPEC_CAPTURE_TEXT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CaptureAfterSaveError);
    expect(count(db, "objects")).toBe(0);
  });

  it("rejects empty, blank or non-string input without writing anything or calling the reasoner", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    for (const bad of ["", "   \n\t ", undefined, null, 42, { content: "x" }]) {
      await expect(captureThought(captureDeps(db, reasoner), bad)).rejects.toBeInstanceOf(CaptureValidationError);
    }
    expect(count(db, "objects")).toBe(0);
    expect(count(db, "events")).toBe(0);
    expect(reasoner.calls).toEqual([]);
  });
});

describe("extraction failures", () => {
  it("keeps the raw thought when extraction output is invalid, and still classifies houses", async () => {
    const db = newTestDb();
    const logs: CaptureLogEntry[] = [];
    const reasoner = mock({ extract: { ...EXTRACTION, title: "x".repeat(81) }, "classify-houses": HOUSES });
    const result = await captureThought(captureDeps(db, reasoner, logs), SPEC_CAPTURE_TEXT);

    expect(result.object).toMatchObject({ content: SPEC_CAPTURE_TEXT, type: "thought", title: null, importance: 0.5 });
    expect(result.concepts).toEqual([]);
    expect(listClaimsForObject(db, result.object.id)).toEqual([]);
    expect(isExtractionComplete(db, result.object.id)).toBe(false);
    expect(result.houseVector).toEqual(vectorOf(HOUSES));
    expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "HOUSE_CLASSIFIED"]);
    expect(result.enrichment).toEqual({ extraction: "failed", houses: "classified", relations: "none" });
    expect(tasks(reasoner)).toEqual(["extract", "classify-houses"]);
    expect(reasoner.calls[1].prompt).toContain('"title": null');
    expect(logs).toContainEqual(expect.objectContaining({ operation: "extract", outcome: "failed", errorKind: "invalid_output" }));
  });

  for (const kind of ["unavailable", "timeout"] as const) {
    it(`keeps the raw thought when the reasoner is ${kind}, uses the house fallback and makes no further calls`, async () => {
      const db = newTestDb();
      persistRawCapture({ db, reasoner: mock({}) }, "an earlier thought, so relation candidates would exist");
      const logs: CaptureLogEntry[] = [];
      const reasoner = mock({ extract: failing(kind), "classify-houses": HOUSES, "infer-relations": noProposals });
      const result = await captureThought(captureDeps(db, reasoner, logs), SPEC_CAPTURE_TEXT);

      expect(tasks(reasoner)).toEqual(["extract"]);
      expect(result.object).toMatchObject({ content: SPEC_CAPTURE_TEXT, type: "thought" });
      expect(result.houseVector).toEqual(FALLBACK);
      expect(count(db, "house_scores")).toBe(12);
      expect(result.relations).toEqual([]);
      expect(result.enrichment).toEqual({ extraction: "failed", houses: "fallback", relations: "skipped" });
      expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "HOUSE_CLASSIFIED"]);
      expect(listEvents(db, { type: "HOUSE_CLASSIFIED" })[0].payload).toEqual({ source: "fallback", reason: "reasoner_unavailable" });
      expect(logs.map((l) => `${l.operation}:${l.outcome}:${l.errorKind ?? ""}`)).toEqual([
        `extract:failed:${kind}`,
        "classify-houses:skipped:reasoner_unavailable",
        "classify-houses:fallback:reasoner_unavailable",
        "infer-relations:skipped:reasoner_unavailable",
      ]);
    });
  }

  it("treats an unexpected reasoner error like an outage", async () => {
    const db = newTestDb();
    const reasoner = mock({
      extract: () => {
        throw new Error("boom");
      },
      "classify-houses": HOUSES,
    });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(tasks(reasoner)).toEqual(["extract"]);
    expect(result.enrichment).toEqual({ extraction: "failed", houses: "fallback", relations: "skipped" });
  });

  it("rolls back only the extraction stage when its writes fail", async () => {
    const db = newTestDb();
    db.exec("CREATE TRIGGER no_claims BEFORE INSERT ON claims BEGIN SELECT RAISE(ABORT, 'test: claims unavailable'); END;");
    const logs: CaptureLogEntry[] = [];
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    const result = await captureThought(captureDeps(db, reasoner, logs), SPEC_CAPTURE_TEXT);

    expect(result.object).toMatchObject({ type: "thought", title: null, content: SPEC_CAPTURE_TEXT });
    expect(count(db, "concepts")).toBe(0);
    expect(count(db, "object_concepts")).toBe(0);
    expect(result.enrichment.extraction).toBe("failed");
    expect(result.houseVector).toEqual(vectorOf(HOUSES));
    expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "HOUSE_CLASSIFIED"]);
    expect(logs).toContainEqual(expect.objectContaining({ operation: "extract", outcome: "failed", errorKind: "persist" }));
  });

  it("records unresolved=false and the stored claim ids in OBJECT_EXTRACTED", async () => {
    const db = newTestDb();
    const settled = { ...EXTRACTION, unresolved: false };
    const { object } = await captureThought(captureDeps(db, mock({ extract: settled, "classify-houses": HOUSES })), SPEC_CAPTURE_TEXT);
    const payload = listEvents(db, { type: "OBJECT_EXTRACTED", objectId: object.id })[0].payload as { unresolved: boolean; claimIds: string[] };
    expect(payload.unresolved).toBe(false);
    expect(payload.claimIds).toEqual(listClaimsForObject(db, object.id).map((c) => c.id));
  });
});

describe("retrying an incomplete capture (SPEC §28)", () => {
  it("re-runs a failed extraction, and afterwards does nothing more", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: failing("invalid_output"), "classify-houses": HOUSES });
    const deps = captureDeps(db, reasoner);
    const { object } = await captureThought(deps, SPEC_CAPTURE_TEXT);

    expect(await retryIncompleteCapture(deps, object.id)).toEqual({ status: "done", extraction: "failed", houses: "already_present" });
    expect(isExtractionComplete(db, object.id)).toBe(false);

    reasoner.setResponse("extract", EXTRACTION);
    expect(await retryIncompleteCapture(deps, object.id)).toEqual({ status: "done", extraction: "ok", houses: "already_present" });
    expect(getObject(db, object.id)).toMatchObject({ type: "idea", title: EXTRACTION.title, content: SPEC_CAPTURE_TEXT });
    expect(listConceptsForObject(db, object.id)).toHaveLength(3);
    expect(listClaimsForObject(db, object.id)).toHaveLength(1);
    expect(eventTypes(db, object.id)).toEqual(["OBJECT_CAPTURED", "HOUSE_CLASSIFIED", "OBJECT_EXTRACTED"]);

    const callsBefore = reasoner.calls.length;
    expect(await retryIncompleteCapture(deps, object.id)).toEqual({ status: "done", extraction: "already_extracted", houses: "already_present" });
    expect(reasoner.calls.length).toBe(callsBefore);
    expect(listClaimsForObject(db, object.id)).toHaveLength(1);
    await expect(retryIncompleteCapture(deps, "missing")).rejects.toThrow(/not found/);
  });

  it("completes a capture that was interrupted before any enrichment", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    const deps = captureDeps(db, reasoner);
    const raw = persistRawCapture(deps, SPEC_CAPTURE_TEXT);
    expect(getHouseScores(db, raw.id)).toBeNull();

    expect(await retryIncompleteCapture(deps, raw.id)).toEqual({ status: "done", extraction: "ok", houses: "classified" });
    expect(tasks(reasoner)).toEqual(["extract", "classify-houses"]);
    expect(getHouseScores(db, raw.id)).toEqual(vectorOf(HOUSES));
    expect(eventTypes(db, raw.id)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED"]);
  });

  it("gives an interrupted capture the fallback vector without a classification call when the reasoner is down", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: failing("unavailable"), "classify-houses": HOUSES });
    const deps = captureDeps(db, reasoner);
    const raw = persistRawCapture(deps, SPEC_CAPTURE_TEXT);
    expect(await retryIncompleteCapture(deps, raw.id)).toEqual({ status: "done", extraction: "failed", houses: "fallback" });
    expect(tasks(reasoner)).toEqual(["extract"]);
    expect(getHouseScores(db, raw.id)).toEqual(FALLBACK);
  });

  it("does not overlap a capture that is still running, or another retry", async () => {
    const db = newTestDb();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let retryDuringCapture: unknown;
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    const deps = captureDeps(db, reasoner);
    reasoner.setResponse("extract", () => EXTRACTION);
    const slow = { ...reasoner, runStructured: reasoner.runStructured.bind(reasoner), healthCheck: reasoner.healthCheck.bind(reasoner) };
    slow.runStructured = async (input) => {
      if (input.task === "extract") await gate;
      return reasoner.runStructured(input);
    };
    const capturing = captureThought({ ...deps, reasoner: slow }, SPEC_CAPTURE_TEXT);
    await new Promise((r) => setTimeout(r, 0));
    const [object] = listObjects(db);
    retryDuringCapture = await retryIncompleteCapture(deps, object.id);
    release();
    await capturing;
    expect(retryDuringCapture).toEqual({ status: "in_progress" });
    expect(tasks(reasoner)).toEqual(["extract", "classify-houses"]);
    expect(listEvents(db, { type: "OBJECT_EXTRACTED" })).toHaveLength(1);

    const failed = persistRawCapture(deps, "another thought");
    const results = await Promise.all([retryIncompleteCapture(deps, failed.id), retryIncompleteCapture(deps, failed.id)]);
    expect(results).toContainEqual({ status: "in_progress" });
    expect(results).toContainEqual({ status: "done", extraction: "ok", houses: "classified" });
    expect(listEvents(db, { type: "OBJECT_EXTRACTED", objectId: failed.id })).toHaveLength(1);
    expect(listClaimsForObject(db, failed.id)).toHaveLength(1);
  });

  it("writes nothing when another writer committed the extraction while the reasoner was working", async () => {
    const db = newTestDb();
    const reasoner = mock({
      extract: () => {
        const [obj] = listObjects(db);
        appendEvent(db, { type: "OBJECT_EXTRACTED", objectId: obj.id, payload: { by: "another process" } });
        return EXTRACTION;
      },
      "classify-houses": HOUSES,
    });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(listEvents(db, { type: "OBJECT_EXTRACTED" })).toHaveLength(1);
    expect(listClaimsForObject(db, result.object.id)).toEqual([]);
    expect(result.concepts).toEqual([]);
    expect(result.object).toMatchObject({ type: "thought", title: null });
  });
});

describe("house classification failures", () => {
  it("persists the exact fallback vector when classification output is invalid", async () => {
    const db = newTestDb();
    const logs: CaptureLogEntry[] = [];
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": housesOutput({ 6: 0.3 }, [6]) });
    const result = await captureThought(captureDeps(db, reasoner, logs), SPEC_CAPTURE_TEXT);

    expect(result.houseVector).toEqual(FALLBACK);
    expect(count(db, "house_scores")).toBe(12);
    expect(result.enrichment).toEqual({ extraction: "ok", houses: "fallback", relations: "none" });
    expect(result.object).toMatchObject({ type: "idea", title: EXTRACTION.title });
    expect(result.concepts).toHaveLength(3);
    expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED"]);
    expect(listEvents(db, { type: "HOUSE_CLASSIFIED" })[0].payload).toEqual({ source: "fallback", reason: "invalid_output" });
    expect(logs).toContainEqual(expect.objectContaining({ operation: "classify-houses", outcome: "fallback", errorKind: "invalid_output" }));
  });

  it("still attempts relation inference after invalid classification, but not after an outage", async () => {
    for (const [kind, expected] of [
      ["invalid_output", ["extract", "classify-houses", "infer-relations"]],
      ["unavailable", ["extract", "classify-houses"]],
    ] as const) {
      const db = newTestDb();
      persistRawCapture({ db, reasoner: mock({}) }, "an earlier thought");
      const reasoner = mock({ extract: EXTRACTION, "classify-houses": failing(kind), "infer-relations": noProposals });
      const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
      expect(tasks(reasoner)).toEqual(expected);
      expect(result.houseVector).toEqual(FALLBACK);
      expect(result.object).toMatchObject({ type: "idea", title: EXTRACTION.title });
      expect(result.enrichment.relations).toBe(kind === "unavailable" ? "skipped" : "ok");
    }
  });

  it("reports a house write failure instead of throwing, and a retry can add the houses later", async () => {
    const db = newTestDb();
    db.exec("CREATE TRIGGER no_houses BEFORE INSERT ON house_scores BEGIN SELECT RAISE(ABORT, 'test: houses unavailable'); END;");
    const logs: CaptureLogEntry[] = [];
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES });
    const deps = captureDeps(db, reasoner, logs);
    const result = await captureThought(deps, SPEC_CAPTURE_TEXT);

    expect(result.enrichment).toEqual({ extraction: "ok", houses: "failed", relations: "none" });
    expect(result.houseVector).toBeNull();
    expect(result.object).toMatchObject({ content: SPEC_CAPTURE_TEXT, type: "idea" });
    expect(count(db, "house_scores")).toBe(0);
    expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED"]);
    expect(logs.filter((l) => l.operation === "classify-houses").map((l) => `${l.outcome}:${l.errorKind}`)).toEqual([
      "failed:persist",
      "fallback:persist",
      "failed:persist",
    ]);

    db.exec("DROP TRIGGER no_houses");
    expect(await retryIncompleteCapture(deps, result.object.id)).toEqual({ status: "done", extraction: "already_extracted", houses: "classified" });
    expect(getHouseScores(db, result.object.id)).toEqual(vectorOf(HOUSES));
  });

  it("records the outage kind as the fallback reason and skips relations after a classification timeout", async () => {
    for (const kind of ["unavailable", "timeout"] as const) {
      const db = newTestDb();
      persistRawCapture({ db, reasoner: mock({}) }, "an earlier thought");
      const reasoner = mock({ extract: EXTRACTION, "classify-houses": failing(kind), "infer-relations": noProposals });
      const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
      expect(tasks(reasoner)).toEqual(["extract", "classify-houses"]);
      expect(result.enrichment).toEqual({ extraction: "ok", houses: "fallback", relations: "skipped" });
      expect(listEvents(db, { type: "HOUSE_CLASSIFIED", objectId: result.object.id })[0].payload).toEqual({ source: "fallback", reason: kind });
    }
  });

  it("gives every fallback capture the identical vector", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": failing("invalid_output"), "infer-relations": noProposals });
    const a = await captureThought(captureDeps(db, reasoner), "first");
    const b = await captureThought(captureDeps(db, reasoner), "second");
    expect(a.houseVector).toEqual(FALLBACK);
    expect(b.houseVector).toEqual(a.houseVector);
  });
});

/** Fake `claude` process runner keyed by system prompt, so the real adapter's retry logic is exercised. */
function scriptedClaude(queues: { extract: unknown[]; houses: unknown[]; relations: unknown[] }) {
  const requests: Array<{ stage: string; stdin: string; maxAttempts: string | undefined }> = [];
  const run = async (req: ProcessRequest): Promise<ProcessResult> => {
    const system = req.args[req.args.indexOf("--system-prompt") + 1];
    const stage = system === EXTRACT_SYSTEM ? "extract" : system === CLASSIFY_HOUSES_SYSTEM ? "houses" : "relations";
    requests.push({ stage, stdin: req.stdin, maxAttempts: req.env.MAX_STRUCTURED_OUTPUT_RETRIES });
    const next = queues[stage as keyof typeof queues].shift();
    if (next === undefined) throw new Error(`unexpected extra ${stage} invocation`);
    const cliGaveUp = next === "cli-schema-exhausted";
    return {
      exitCode: cliGaveUp ? 1 : 0,
      signal: null,
      stdout: JSON.stringify(
        cliGaveUp
          ? { type: "result", subtype: "error_max_structured_output_retries", is_error: true, errors: ["last StructuredOutput error: schema mismatch"] }
          : { type: "result", subtype: "success", is_error: false, structured_output: next },
      ),
      stderr: "",
      timedOut: false,
      spawnError: null,
    };
  };
  return { reasoner: new ClaudeSubscriptionReasoner({ run, cwd: "/n" }), requests };
}

describe("retry limits with the real adapter and a fake CLI", () => {
  const badHouses = housesOutput({ 1: 0.2, 2: 0.9 }, [1, 2]);

  it("retries classification once with the validation errors, then succeeds", async () => {
    const db = newTestDb();
    const { reasoner, requests } = scriptedClaude({ extract: [EXTRACTION], houses: [badHouses, HOUSES], relations: [] });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(requests.map((r) => r.stage)).toEqual(["extract", "houses", "houses"]);
    expect(requests[2].stdin).toContain("dominant house 1 must score >= 0.35");
    expect(result.enrichment.houses).toBe("classified");
    expect(result.houseVector).toEqual(vectorOf(HOUSES));
  });

  it("falls back after exactly one classification retry", async () => {
    const db = newTestDb();
    const logs: CaptureLogEntry[] = [];
    const { reasoner, requests } = scriptedClaude({ extract: [EXTRACTION], houses: [badHouses, "cli-schema-exhausted"], relations: [] });
    const result = await captureThought(captureDeps(db, reasoner, logs), SPEC_CAPTURE_TEXT);
    expect(requests.map((r) => r.stage)).toEqual(["extract", "houses", "houses"]);
    expect(result.houseVector).toEqual(FALLBACK);
    expect(logs).toContainEqual(expect.objectContaining({ operation: "classify-houses", outcome: "fallback", errorKind: "invalid_output" }));
  });

  it("caps a capture whose every stage fails at six CLI invocations, each limited to one model attempt", async () => {
    const db = newTestDb();
    persistRawCapture({ db, reasoner: new MockReasoner() }, "an earlier thought, so relation inference runs");
    const bad = "cli-schema-exhausted";
    const { reasoner, requests } = scriptedClaude({ extract: [bad, bad, bad], houses: [bad, bad, bad], relations: [bad, bad, bad] });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(requests.map((r) => r.stage)).toEqual(["extract", "extract", "houses", "houses", "relations", "relations"]);
    expect(requests.every((r) => r.maxAttempts === "1")).toBe(true);
    expect(result.object.content).toBe(SPEC_CAPTURE_TEXT);
    expect(result.enrichment).toEqual({ extraction: "failed", houses: "fallback", relations: "failed" });
    expect(result.relations).toEqual([]);
  });
});

describe("relation inference", () => {
  const NOW = new Date("2026-09-16T12:00:00.000Z");

  function proposeTo(picks: Array<{ index: number; type: string; confidence: number }>): MockResponse {
    return (input) => {
      const { candidates } = parseRelationPrompt(input.prompt);
      return {
        proposals: picks
          .filter((p) => p.index < candidates.length)
          .map((p) => ({ targetId: candidates[p.index].id, type: p.type, confidence: p.confidence, rationale: `rel ${p.index}` })),
      };
    };
  }

  it("persists at most three proposed relations against the seeded dataset (SPEC §32 relation test)", async () => {
    const db = newTestDb();
    seedDemo(db, NOW);
    const logs: CaptureLogEntry[] = [];
    const reasoner = mock({
      extract: EXTRACTION,
      "classify-houses": HOUSES,
      "infer-relations": proposeTo([
        { index: 0, type: "supports", confidence: 0.9 },
        { index: 1, type: "contradicts", confidence: 0.7 },
        { index: 2, type: "extends", confidence: 0.6 },
      ]),
    });
    const result = await captureThought(captureDeps(db, reasoner, logs), SPEC_CAPTURE_TEXT);
    const prompt = parseRelationPrompt(reasoner.calls[2].prompt);

    expect(prompt.candidates.length).toBeGreaterThan(0);
    expect(prompt.candidates.length).toBeLessThanOrEqual(MAX_RELATION_CANDIDATES);
    expect(prompt.candidates.map((c) => c.id)).not.toContain(result.object.id);
    expect(prompt.source.id).toBe(result.object.id);
    expect(result.relations).toHaveLength(3);
    for (const r of result.relations) {
      expect(r).toMatchObject({ sourceId: result.object.id, origin: "ai_inferred", status: "proposed" });
      expect(prompt.candidates.map((c) => c.id)).toContain(r.targetId);
    }
    expect(result.relations.map((r) => r.confidence).sort((a, b) => b - a)).toEqual([0.9, 0.7, 0.6]);
    expect(count(db, "relations WHERE origin = 'ai_inferred' AND status <> 'proposed'")).toBe(0);
    const proposed = listEvents(db, { type: "RELATION_PROPOSED", objectId: result.object.id });
    expect(proposed.map((e) => e.payload.relationId).sort()).toEqual(result.relations.map((r) => r.id).sort());
    expect(listEvents(db, { type: "RELATION_ACCEPTED", objectId: result.object.id })).toEqual([]);
    expect(result.enrichment.relations).toBe("ok");
  });

  it("sends at most eight candidates, ranked by relevance, and never the new object", async () => {
    const db = newTestDb();
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES, "infer-relations": noProposals });
    const deps = captureDeps(db, reasoner);
    const earlier: string[] = [];
    for (let i = 0; i < 12; i++) earlier.push((await captureThought(deps, `related thought ${i}`)).object.id);
    reasoner.calls.length = 0;

    const { object } = await captureThought(deps, SPEC_CAPTURE_TEXT);
    const { candidates } = parseRelationPrompt(reasoner.calls.find((c) => c.task === "infer-relations")!.prompt);
    expect(candidates).toHaveLength(MAX_RELATION_CANDIDATES);
    expect(candidates.map((c) => c.id)).not.toContain(object.id);
    // All earlier objects share concepts and houses equally, so recency decides: the 8 newest, newest first.
    expect(candidates.map((c) => c.id)).toEqual(earlier.slice(-8).reverse());
    expect(candidates[0].sharedConcepts.sort()).toEqual(["AI memory", "Model weights", "persistence"]);
    expect(candidates[0].houseSimilarity).toBe(1);
  });

  it("ranks candidates deterministically for identical data", async () => {
    const run = async () => {
      const db = newTestDb();
      seedDemo(db, NOW);
      const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES, "infer-relations": noProposals });
      await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
      return parseRelationPrompt(reasoner.calls[2].prompt).candidates.map((c) => c.id);
    };
    const first = await run();
    expect(await run()).toEqual(first);
    expect(first.every((id) => id.startsWith("seed-"))).toBe(true);
  });

  it("includes up to two recent objects even when nothing overlaps", async () => {
    const db = newTestDb();
    const gardening = { ...EXTRACTION, title: "Garden", concepts: [{ name: "gardening" }], claims: [] };
    const reasoner = mock({
      extract: (input) => (input.prompt.includes("garden") ? gardening : EXTRACTION),
      "classify-houses": (input) => (input.prompt.includes("garden") ? housesOutput({ 12: 0.9 }, [12]) : HOUSES),
      "infer-relations": noProposals,
    });
    const deps = captureDeps(db, reasoner);
    const ids: string[] = [];
    for (const t of ["garden one", "garden two", "garden three"]) ids.push((await captureThought(deps, t)).object.id);
    reasoner.calls.length = 0;
    await captureThought(deps, SPEC_CAPTURE_TEXT);
    const { candidates } = parseRelationPrompt(reasoner.calls[2].prompt);
    expect(candidates.map((c) => c.id)).toEqual([ids[2], ids[1]]);
    expect(candidates.every((c) => c.sharedConcepts.length === 0)).toBe(true);
  });

  describe("candidate pool and ranking", () => {
    const gardening = { ...EXTRACTION, title: "Garden", concepts: [{ name: "gardening" }], claims: [] };
    const craft = { ...EXTRACTION, title: "Craft", concepts: [{ name: "woodworking" }], claims: [] };
    // Focus houses: 2, 4, 5 and 8 at or above 0.35 (HOUSES).
    const pick = (text: string) =>
      text.includes("garden") ? { e: gardening, h: housesOutput({ 12: 0.9 }, [12]) }
      : text.includes("craft-overlap") ? { e: craft, h: housesOutput({ 2: 0.9 }, [2]) }
      : text.includes("craft-weak") ? { e: craft, h: housesOutput({ 2: 0.3, 11: 0.9 }, [11]) }
      : { e: EXTRACTION, h: HOUSES };
    const reasonerFor = () =>
      mock({
        extract: (input) => pick(input.prompt).e,
        "classify-houses": (input) => pick(input.prompt).h,
        "infer-relations": noProposals,
      });
    const candidatesOf = (m: MockReasoner) => parseRelationPrompt(m.calls.filter((c) => c.task === "infer-relations").at(-1)!.prompt).candidates;

    it("ranks an older related object above a newer unrelated one", async () => {
      const db = newTestDb();
      const reasoner = reasonerFor();
      const deps = captureDeps(db, reasoner);
      const related = (await captureThought(deps, "related old")).object.id;
      const unrelated = (await captureThought(deps, "garden new")).object.id;
      await captureThought(deps, SPEC_CAPTURE_TEXT);
      expect(candidatesOf(reasoner).map((c) => c.id)).toEqual([related, unrelated]);
    });

    it("drops newer unrelated objects when eight more relevant candidates exist", async () => {
      const db = newTestDb();
      const reasoner = reasonerFor();
      const deps = captureDeps(db, reasoner);
      const related: string[] = [];
      for (let i = 0; i < 8; i++) related.push((await captureThought(deps, `related ${i}`)).object.id);
      const newest = [(await captureThought(deps, "garden a")).object.id, (await captureThought(deps, "garden b")).object.id];
      await captureThought(deps, SPEC_CAPTURE_TEXT);
      const ids = candidatesOf(reasoner).map((c) => c.id);
      expect(ids).toHaveLength(8);
      expect(ids.sort()).toEqual([...related].sort());
      for (const id of newest) expect(ids).not.toContain(id);
    });

    it("adds objects that overlap only in a house scoring at least 0.35 in both", async () => {
      const db = newTestDb();
      const reasoner = reasonerFor();
      const deps = captureDeps(db, reasoner);
      const overlap = (await captureThought(deps, "craft-overlap")).object.id;
      const weak = (await captureThought(deps, "craft-weak")).object.id;
      await captureThought(deps, "garden a");
      await captureThought(deps, "garden b");
      await captureThought(deps, SPEC_CAPTURE_TEXT);
      const ids = candidatesOf(reasoner).map((c) => c.id);
      expect(ids).toContain(overlap);
      expect(ids).not.toContain(weak);
      expect(ids).toHaveLength(3);
      expect(candidatesOf(reasoner).find((c) => c.id === overlap)!.sharedConcepts).toEqual([]);
    });
  });

  it("discards low-confidence and duplicate proposals", async () => {
    const db = newTestDb();
    persistRawCapture({ db, reasoner: mock({}) }, "earlier A");
    persistRawCapture({ db, reasoner: mock({}) }, "earlier B");
    const reasoner = mock({
      extract: EXTRACTION,
      "classify-houses": HOUSES,
      "infer-relations": proposeTo([
        { index: 0, type: "supports", confidence: 0.6 },
        { index: 0, type: "supports", confidence: 0.8 },
        { index: 1, type: "questions", confidence: 0.54 },
      ]),
    });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]).toMatchObject({ type: "supports", confidence: 0.8, status: "proposed" });
    expect(listEvents(db, { type: "RELATION_PROPOSED" })).toHaveLength(1);
  });

  for (const [label, response] of [
    ["more than three proposals", proposeTo([0, 1, 2, 3].map((index) => ({ index, type: "related_to", confidence: 0.9 })))],
    ["an invented target id", () => ({ proposals: [{ targetId: "not-a-candidate", type: "supports", confidence: 0.9, rationale: "x" }] })],
    ["an unknown relation type", proposeTo([{ index: 0, type: "resembles", confidence: 0.9 }])],
  ] as const) {
    it(`rejects ${label} and keeps everything captured so far`, async () => {
      const db = newTestDb();
      const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES, "infer-relations": noProposals });
      const deps = captureDeps(db, reasoner);
      for (let i = 0; i < 4; i++) await captureThought(deps, `earlier related ${i}`);
      reasoner.setResponse("infer-relations", response);
      reasoner.calls.length = 0;
      const result = await captureThought(deps, SPEC_CAPTURE_TEXT);
      expect(parseRelationPrompt(reasoner.calls[2].prompt).candidates).toHaveLength(4);
      expect(result.relations).toEqual([]);
      expect(count(db, "relations")).toBe(0);
      expect(result.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "failed" });
      expect(result.object).toMatchObject({ type: "idea", title: EXTRACTION.title });
      expect(result.concepts).toHaveLength(3);
      expect(listClaimsForObject(db, result.object.id)).toHaveLength(1);
      expect(result.houseVector).toEqual(vectorOf(HOUSES));
      expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED"]);
    });
  }

  it("keeps object, concepts, claims and houses when relation inference is unavailable or its writes fail", async () => {
    for (const mode of ["unavailable", "persist"] as const) {
      const db = newTestDb();
      persistRawCapture({ db, reasoner: mock({}) }, "earlier");
      if (mode === "persist") {
        db.exec("CREATE TRIGGER no_relations BEFORE INSERT ON relations BEGIN SELECT RAISE(ABORT, 'test: relations unavailable'); END;");
      }
      const reasoner = mock({
        extract: EXTRACTION,
        "classify-houses": HOUSES,
        "infer-relations": mode === "unavailable" ? failing("unavailable") : proposeTo([{ index: 0, type: "supports", confidence: 0.9 }]),
      });
      const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
      expect(result.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "failed" });
      expect(result.relations).toEqual([]);
      expect(result.concepts).toHaveLength(3);
      expect(listClaimsForObject(db, result.object.id)).toHaveLength(1);
      expect(result.houseVector).toEqual(vectorOf(HOUSES));
      expect(listEvents(db, { type: "RELATION_PROPOSED" })).toEqual([]);
    }
  });

  it("makes one relation call and no retry when relation inference is unavailable", async () => {
    const db = newTestDb();
    persistRawCapture({ db, reasoner: mock({}) }, "earlier");
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES, "infer-relations": failing("unavailable") });
    await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(tasks(reasoner)).toEqual(["extract", "classify-houses", "infer-relations"]);
  });

  it("rolls back every proposal when one of them cannot be written", async () => {
    const db = newTestDb();
    persistRawCapture({ db, reasoner: mock({}) }, "earlier A");
    persistRawCapture({ db, reasoner: mock({}) }, "earlier B");
    db.exec(
      "CREATE TRIGGER second_relation_fails BEFORE INSERT ON relations WHEN (SELECT COUNT(*) FROM relations) >= 1 BEGIN SELECT RAISE(ABORT, 'test: second relation fails'); END;",
    );
    const reasoner = mock({
      extract: EXTRACTION,
      "classify-houses": HOUSES,
      "infer-relations": proposeTo([
        { index: 0, type: "supports", confidence: 0.9 },
        { index: 1, type: "extends", confidence: 0.8 },
      ]),
    });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(result.enrichment.relations).toBe("failed");
    expect(count(db, "relations")).toBe(0);
    expect(listEvents(db, { type: "RELATION_PROPOSED" })).toEqual([]);
  });

  it("reports a candidate-selection failure as a relation failure", async () => {
    const db = newTestDb();
    persistRawCapture({ db, reasoner: mock({}) }, "earlier");
    const reasoner = mock({
      extract: EXTRACTION,
      "classify-houses": () => {
        db.exec("DROP TABLE feedback");
        return HOUSES;
      },
      "infer-relations": noProposals,
    });
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(result.enrichment).toEqual({ extraction: "ok", houses: "classified", relations: "failed" });
    expect(tasks(reasoner)).toEqual(["extract", "classify-houses"]);
  });

  it("keeps the relation system prompt fixed, cuts long candidates to 600 characters, and sends the source in full", async () => {
    const db = newTestDb();
    const longCandidate = `${"c".repeat(CANDIDATE_CONTENT_CHARS)}TAIL-SHOULD-NOT-BE-SENT`;
    const longSource = `${SPEC_CAPTURE_TEXT} ${"s".repeat(900)} SOURCE-END`;
    const reasoner = mock({
      extract: EXTRACTION,
      "classify-houses": HOUSES,
      "infer-relations": proposeTo([{ index: 0, type: "supports", confidence: 0.9 }]),
    });
    const deps = captureDeps(db, reasoner);
    persistRawCapture(deps, longCandidate);
    const result = await captureThought(deps, longSource);
    const call = reasoner.calls.find((c) => c.task === "infer-relations")!;
    const prompt = parseRelationPrompt(call.prompt);
    expect(call.system).toBe(INFER_RELATIONS_SYSTEM);
    expect(call.system).not.toContain("SOURCE-END");
    expect(call.system).not.toContain("TAIL-SHOULD");
    expect(prompt.source.content).toBe(longSource);
    expect(prompt.candidates[0].content).toBe(`${"c".repeat(CANDIDATE_CONTENT_CHARS)}...`);
    expect(result.relations[0].rationale).toBe("rel 0");
  });

  it("does not store a symmetric relation twice when two captures overlap, but keeps both directions of a directed one", async () => {
    for (const [type, expected] of [
      ["related_to", 1],
      ["supports", 2],
    ] as const) {
      const db = newTestDb();
      const reasoner = mock({
        extract: EXTRACTION,
        "classify-houses": HOUSES,
        "infer-relations": proposeTo([{ index: 0, type, confidence: 0.9 }]),
      });
      const deps = captureDeps(db, reasoner);
      const [a, b] = await Promise.all([captureThought(deps, "thought A about AI memory"), captureThought(deps, "thought B about AI memory")]);
      const all = [...listRelationsForObject(db, a.object.id)];
      expect(all).toHaveLength(expected);
      expect(listEvents(db, { type: "RELATION_PROPOSED" })).toHaveLength(expected);
      expect(new Set(all.map((r) => [r.sourceId, r.targetId].sort().join()))).toEqual(new Set([[a.object.id, b.object.id].sort().join()]));
    }
  });

  it("captures the same text twice as two objects, reusing concepts and proposing a link to the first", async () => {
    const db = newTestDb();
    const reasoner = mock({
      extract: EXTRACTION,
      "classify-houses": HOUSES,
      "infer-relations": proposeTo([{ index: 0, type: "related_to", confidence: 0.7 }]),
    });
    const deps = captureDeps(db, reasoner);
    const first = await captureThought(deps, SPEC_CAPTURE_TEXT);
    const second = await captureThought(deps, SPEC_CAPTURE_TEXT);

    expect(second.object.id).not.toBe(first.object.id);
    expect(listObjects(db)).toHaveLength(2);
    expect(count(db, "concepts")).toBe(3);
    expect(count(db, "object_concepts")).toBe(6);
    expect(second.concepts.map((c) => c.id).sort()).toEqual(first.concepts.map((c) => c.id).sort());
    expect(first.enrichment.relations).toBe("none");
    expect(second.relations).toEqual([expect.objectContaining({ sourceId: second.object.id, targetId: first.object.id, status: "proposed" })]);
    expect(tasks(reasoner)).toEqual(["extract", "classify-houses", "extract", "classify-houses", "infer-relations"]);
  });
});

describe("event history", () => {
  it("records events in pipeline order, append-only, with non-decreasing timestamps", async () => {
    const db = newTestDb();
    let capturedEventSnapshot: unknown;
    const reasoner = mock({
      extract: (input) => {
        capturedEventSnapshot = listEvents(db, { type: "OBJECT_CAPTURED" }).at(-1);
        void input;
        return EXTRACTION;
      },
      "classify-houses": HOUSES,
      "infer-relations": (input) => {
        const { candidates } = parseRelationPrompt(input.prompt);
        return {
          proposals: candidates.slice(0, 2).map((c, i) => ({ targetId: c.id, type: "supports", confidence: 0.9 - i / 10, rationale: "r" })),
        };
      },
    });
    const deps = captureDeps(db, reasoner);
    persistRawCapture(deps, "earlier A");
    persistRawCapture(deps, "earlier B");
    const { object } = await captureThought(deps, SPEC_CAPTURE_TEXT);
    const events = listEvents(db, { objectId: object.id });
    expect(events.map((e) => e.type)).toEqual(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED", "RELATION_PROPOSED", "RELATION_PROPOSED"]);
    const times = events.map((e) => Date.parse(e.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[0]).toBeLessThan(times[1]);
    expect(times[1]).toBeLessThan(times[2]);
    expect(events[0]).toEqual(capturedEventSnapshot);
    const allowed = new Set(["OBJECT_CAPTURED", "OBJECT_EXTRACTED", "HOUSE_CLASSIFIED", "RELATION_PROPOSED"]);
    expect(listEvents(db).every((e) => allowed.has(e.type))).toBe(true);
  });

  it("records only the raw capture and the fallback when the reasoner is down entirely", async () => {
    const db = newTestDb();
    persistRawCapture({ db, reasoner: mock({}) }, "earlier");
    const reasoner = mock({ extract: EXTRACTION, "classify-houses": HOUSES, "infer-relations": noProposals }, true);
    const result = await captureThought(captureDeps(db, reasoner), SPEC_CAPTURE_TEXT);
    expect(tasks(reasoner)).toEqual(["extract"]);
    expect(eventTypes(db, result.object.id)).toEqual(["OBJECT_CAPTURED", "HOUSE_CLASSIFIED"]);
    expect(result).toMatchObject({
      object: { content: SPEC_CAPTURE_TEXT, type: "thought", title: null },
      houseVector: FALLBACK,
      concepts: [],
      relations: [],
      enrichment: { extraction: "failed", houses: "fallback", relations: "skipped" },
    });
  });
});
