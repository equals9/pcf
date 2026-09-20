import { describe, expect, it } from "vitest";
import type { PcfDatabase } from "../../lib/db/database";
import { attachConcept, upsertConcept } from "../../lib/db/repositories/concepts";
import { appendEvent, listEvents } from "../../lib/db/repositories/events";
import { insertFeedback } from "../../lib/db/repositories/feedback";
import { getObject, insertObject, setHouseScores, updateObject } from "../../lib/db/repositories/objects";
import { houseVector } from "../../lib/domain/houses";
import type { CognitiveObject, HouseNumber, HouseVector } from "../../lib/domain/types";
import {
  ACTIVATION_WINDOW_HOURS,
  AGE_SATURATION_DAYS,
  RESURFACE_WEIGHTS,
  ageSaturation,
  resurfaceCandidates,
  resurfaceForToday,
  resurfaceScore,
  selectResurfaced,
  unresolvedness,
  whyReturned,
} from "../../lib/engine/resurfacing";
import { newId } from "../../lib/utils/ids";
import { localDayBounds } from "../../lib/utils/time";
import { count, newTestDb } from "../fixtures/capture-fixtures";

// SPEC §22: at most one returned thought, chosen by a frozen deterministic score. No AI, no feed, and the
// object itself is never rewritten.

const NOW = new Date("2026-09-18T15:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function houses(peaks: Partial<Record<HouseNumber, number>>): HouseVector {
  const v = houseVector(0.05);
  for (const [k, s] of Object.entries(peaks)) v[Number(k) as HouseNumber] = s as number;
  return v;
}

function add(
  db: PcfDatabase,
  id: string,
  opts: {
    at: string;
    type?: CognitiveObject["type"];
    importance?: number;
    concepts?: string[];
    vector?: HouseVector;
    status?: CognitiveObject["status"];
  },
) {
  insertObject(db, {
    id,
    type: opts.type ?? "thought",
    content: `content of ${id}`,
    title: `title of ${id}`,
    createdAt: opts.at,
    updatedAt: opts.at,
    lastActivatedAt: null,
    importance: opts.importance ?? 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
  });
  for (const name of opts.concepts ?? []) attachConcept(db, id, upsertConcept(db, name, opts.at).id);
  setHouseScores(db, id, opts.vector ?? houses({ 2: 0.9 }));
  if (opts.status && opts.status !== "active") updateObject(db, id, { status: opts.status }, opts.at);
}

describe("§22 score", () => {
  it("uses the frozen weights", () => {
    expect(RESURFACE_WEIGHTS).toEqual({ relevance: 0.45, unresolvedness: 0.25, age: 0.15, importance: 0.15 });
    expect(AGE_SATURATION_DAYS).toBe(60);
    expect(ACTIVATION_WINDOW_HOURS).toBe(24);
    const score = resurfaceScore({ relevance: 1, unresolvedness: 1, age: 1, importance: 1 });
    expect(score.total).toBeCloseTo(1, 12);
    expect(resurfaceScore({ relevance: 0.5, unresolvedness: 0.4, age: 0.2, importance: 0.8 }).total).toBeCloseTo(
      0.45 * 0.5 + 0.25 * 0.4 + 0.15 * 0.2 + 0.15 * 0.8,
      12,
    );
  });

  it("renormalizes when there is nothing today", () => {
    const score = resurfaceScore({ relevance: null, unresolvedness: 1, age: 1, importance: 1 });
    expect(score.withoutRelevance).toBe(true);
    expect(score.total).toBeCloseTo(1, 12);
    expect(resurfaceScore({ relevance: null, unresolvedness: 1, age: 0, importance: 0 }).total).toBeCloseTo(0.25 / 0.55, 12);
  });

  it("scores unresolvedness by type and status (§22)", () => {
    const of = (type: CognitiveObject["type"], status: CognitiveObject["status"] = "active") =>
      unresolvedness({ type, status } as CognitiveObject);
    expect(of("question")).toBe(1);
    expect(of("claim")).toBe(0.7);
    expect(of("belief")).toBe(0.7);
    expect(of("idea")).toBe(0.6);
    expect(of("thought")).toBe(0.3);
    expect(of("experiment")).toBe(0.3);
    expect(of("question", "resolved")).toBe(0);
    expect(of("idea", "resolved")).toBe(0);
  });

  it("saturates age at 60 days", () => {
    const at = (days: number) => ageSaturation({ createdAt: daysAgo(days) } as CognitiveObject, NOW);
    expect(at(0)).toBe(0);
    expect(at(30)).toBeCloseTo(0.5, 6);
    expect(at(60)).toBe(1);
    expect(at(600)).toBe(1);
  });
});

describe("§22 candidates", () => {
  it("takes only objects created before today, not archived, not activated in 24 hours", () => {
    const db = newTestDb();
    add(db, "old", { at: daysAgo(10) });
    add(db, "today", { at: hoursAgo(2) });
    add(db, "archived", { at: daysAgo(10), status: "archived" });
    add(db, "resurfaced-recently", { at: daysAgo(10) });
    appendEvent(db, { type: "OBJECT_RESURFACED", objectId: "resurfaced-recently", createdAt: hoursAgo(3) });
    add(db, "opened-recently", { at: daysAgo(10) });
    appendEvent(db, { type: "OBJECT_OPENED", objectId: "opened-recently", createdAt: hoursAgo(5) });
    add(db, "resurfaced-long-ago", { at: daysAgo(10) });
    appendEvent(db, { type: "OBJECT_RESURFACED", objectId: "resurfaced-long-ago", createdAt: hoursAgo(30) });

    expect(resurfaceCandidates(db, NOW).map((c) => c.object.id).sort()).toEqual(["old", "resurfaced-long-ago"]);
  });

  it("scores relevance against today's thoughts, and omits it when today is empty", () => {
    const db = newTestDb();
    add(db, "today", { at: hoursAgo(1), concepts: ["memory"] });
    add(db, "shares-concept", { at: daysAgo(40), concepts: ["memory"] });
    add(db, "unrelated", { at: daysAgo(40), concepts: ["gardening"], vector: houses({ 11: 0.9 }) });

    const withToday = resurfaceCandidates(db, NOW);
    const shares = withToday.find((c) => c.object.id === "shares-concept")!;
    expect(shares.score.withoutRelevance).toBe(false);
    expect(shares.score.relevance).toBeGreaterThan(withToday.find((c) => c.object.id === "unrelated")!.score.relevance);
    expect(shares.nearestTodayId).toBe("today");

    const empty = newTestDb();
    add(empty, "old", { at: daysAgo(40) });
    const alone = resurfaceCandidates(empty, NOW)[0];
    expect(alone.score.withoutRelevance).toBe(true);
    expect(alone.nearestTodayId).toBeNull();
  });
});

describe("§22 selection", () => {
  it("returns the highest-scoring thought, deterministically", () => {
    const db = newTestDb();
    add(db, "today", { at: hoursAgo(1), concepts: ["memory"] });
    add(db, "open-question", { at: daysAgo(90), type: "question", importance: 0.9, concepts: ["memory"] });
    add(db, "passing-thought", { at: daysAgo(3), type: "thought", importance: 0.2, concepts: ["gardening"], vector: houses({ 11: 0.9 }) });

    const chosen = selectResurfaced(resurfaceCandidates(db, NOW))!;
    expect(chosen.object.id).toBe("open-question");
    expect(selectResurfaced(resurfaceCandidates(db, NOW))!.object.id).toBe(chosen.object.id);
  });

  it("breaks ties on the older thought, then the lower id", () => {
    const db = newTestDb();
    add(db, "bbb", { at: daysAgo(40) });
    add(db, "aaa", { at: daysAgo(40) });
    add(db, "older", { at: daysAgo(41) });
    const candidates = resurfaceCandidates(db, NOW).map((c) => ({ ...c, score: { ...c.score, total: 0.5 } }));
    expect(selectResurfaced(candidates)!.object.id).toBe("older");
    expect(selectResurfaced(candidates.filter((c) => c.object.id !== "older"))!.object.id).toBe("aaa");
  });

  it("returns null when nothing qualifies", () => {
    const db = newTestDb();
    add(db, "today", { at: hoursAgo(1) });
    expect(selectResurfaced(resurfaceCandidates(db, NOW))).toBeNull();
    expect(resurfaceForToday(db, NOW)).toBeNull();
  });
});

describe("§22 display", () => {
  it("records OBJECT_RESURFACED once a day and changes nothing else", () => {
    const db = newTestDb();
    add(db, "old", { at: daysAgo(90), type: "question" });
    const before = getObject(db, "old");

    const first = resurfaceForToday(db, NOW)!;
    expect(first.object.id).toBe("old");
    expect(listEvents(db, { type: "OBJECT_RESURFACED", objectId: "old" })).toHaveLength(1);

    // Re-rendering Today must not append another event.
    resurfaceForToday(db, new Date(NOW.getTime() + 60_000));
    resurfaceForToday(db, new Date(NOW.getTime() + 120_000));
    expect(listEvents(db, { type: "OBJECT_RESURFACED", objectId: "old" })).toHaveLength(1);

    expect(getObject(db, "old")).toEqual(before);
    expect(count(db, "objects")).toBe(1);
    expect(count(db, "relations")).toBe(0);
    expect(count(db, "claims")).toBe(0);
    expect(listEvents(db).map((e) => e.type)).toEqual(["OBJECT_RESURFACED"]);
  });

  it("shows the same thought on every reload that day, never the next one down", () => {
    const db = newTestDb();
    add(db, "old-1", { at: daysAgo(90), type: "question" });
    add(db, "old-2", { at: daysAgo(120), type: "question" });
    add(db, "old-3", { at: daysAgo(150), type: "question" });

    const first = resurfaceForToday(db, NOW)!;
    for (let i = 1; i <= 5; i++) {
      expect(resurfaceForToday(db, new Date(NOW.getTime() + i * 60_000))!.object.id).toBe(first.object.id);
    }
    expect(listEvents(db, { type: "OBJECT_RESURFACED" })).toHaveLength(1);
  });

  it("stops returning a thought the user dismissed today, and offers the next one", () => {
    const db = newTestDb();
    add(db, "old-1", { at: daysAgo(90), type: "question" });
    add(db, "old-2", { at: daysAgo(120), type: "question" });

    const first = resurfaceForToday(db, NOW)!;
    insertFeedback(db, {
      id: newId(),
      targetType: "object",
      targetId: first.object.id,
      action: "dismissed",
      createdAt: new Date(NOW.getTime() + 1000).toISOString(),
    });

    const next = resurfaceForToday(db, new Date(NOW.getTime() + 2000));
    expect(next).not.toBeNull();
    expect(next!.object.id).not.toBe(first.object.id);
    // Dismissing the second one too leaves nothing to return today.
    insertFeedback(db, {
      id: newId(),
      targetType: "object",
      targetId: next!.object.id,
      action: "dismissed",
      createdAt: new Date(NOW.getTime() + 3000).toISOString(),
    });
    expect(resurfaceForToday(db, new Date(NOW.getTime() + 4000))).toBeNull();
  });

  it("keeps a thought dismissed today away even when its last return was over a day ago", () => {
    const db = newTestDb();
    add(db, "dismissed-today", { at: daysAgo(200), type: "question" });
    add(db, "other", { at: daysAgo(90), type: "question" });
    // Returned 26 hours ago, so the 24-hour activation rule no longer covers it...
    appendEvent(db, { type: "OBJECT_RESURFACED", objectId: "dismissed-today", payload: {}, createdAt: hoursAgo(26) });
    // ...but the user waved it away earlier today.
    insertFeedback(db, {
      id: newId(),
      targetType: "object",
      targetId: "dismissed-today",
      action: "dismissed",
      createdAt: new Date(Date.parse(localDayBounds(NOW).start) + 60_000).toISOString(),
    });

    expect(resurfaceCandidates(db, NOW).map((c) => c.object.id)).not.toContain("dismissed-today");
    expect(resurfaceForToday(db, NOW)!.object.id).toBe("other");
  });

  it("uses the candidate's own feedback in the §19 relevance term", () => {
    const db = newTestDb();
    add(db, "today", { at: hoursAgo(1), concepts: ["memory"] });
    // Identical twins but for feedback. "liked" is the newer thought and the higher id, so if feedback were
    // ignored the tie-break (older, then lower id) would pick "ignored" instead.
    add(db, "ignored", { at: daysAgo(100), concepts: ["memory"] });
    add(db, "liked", { at: daysAgo(90), concepts: ["memory"] });
    insertFeedback(db, {
      id: newId(),
      targetType: "object",
      targetId: "liked",
      action: "useful",
      // Older than the activation window, so the thought is still a candidate.
      createdAt: hoursAgo(ACTIVATION_WINDOW_HOURS + 5),
    });

    const scores = new Map(resurfaceCandidates(db, NOW).map((c) => [c.object.id, c.score.relevance]));
    expect(scores.get("liked")!).toBeGreaterThan(scores.get("ignored")!);
    expect(resurfaceForToday(db, NOW)!.object.id).toBe("liked");
  });

  it("explains why it returned, from the score alone", () => {
    const db = newTestDb();
    add(db, "today", { at: hoursAgo(1), concepts: ["memory"] });
    add(db, "old-question", { at: daysAgo(120), type: "question", importance: 0.9, concepts: ["memory"] });
    const resurfaced = resurfaceForToday(db, NOW)!;
    expect(resurfaced.why).toMatch(/\.$/);
    expect(resurfaced.why.length).toBeGreaterThan(10);
    expect(resurfaced.ageDays).toBe(120);

    const quiet = whyReturned(
      { object: { type: "thought", importance: 0.2 } as never, score: { total: 0, relevance: 0, closeness: 0, unresolvedness: 0.3, age: 0.1, importance: 0.2, withoutRelevance: true }, nearestTodayId: null },
      null,
    );
    expect(quiet).toBe("It has been quiet for a while.");
  });

  it("does not claim shared ground when nothing is actually shared", () => {
    // Relevance can be non-zero from time and feedback alone. That is not closeness, and §25E must not say
    // the thought shares ground with today's thinking when it shares no concept, house or link.
    const why = whyReturned(
      {
        object: { type: "thought", importance: 0.2 } as never,
        score: { total: 0.2, relevance: 0.2, closeness: 0, unresolvedness: 0.3, age: 0.1, importance: 0.2, withoutRelevance: false },
        nearestTodayId: "today",
      },
      "title of today",
    );
    expect(why).toBe("It has been quiet for a while.");
    expect(why).not.toContain("shares ground");
  });

  it("names the thought it is close to, when there is one", () => {
    const db = newTestDb();
    add(db, "today", { at: hoursAgo(1), concepts: ["memory"] });
    add(db, "old", { at: daysAgo(5), concepts: ["memory"] });
    expect(resurfaceForToday(db, NOW)!.why).toContain("title of today");
  });
});
