import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ReasonerError } from "../../lib/ai/reasoner";
import { MockReasoner } from "../fixtures/mock-reasoner";

const schema = z.object({ answer: z.number().min(0).max(1) });

describe("MockReasoner", () => {
  it("returns deterministic, schema-validated responses and records calls", async () => {
    const m = new MockReasoner({ responses: { score: { answer: 0.4 }, dynamic: (i) => ({ answer: i.prompt.length / 10 }) } });
    await expect(m.runStructured({ task: "score", system: "s", prompt: "p", schema })).resolves.toEqual({ answer: 0.4 });
    await expect(m.runStructured({ task: "dynamic", system: "s", prompt: "abcde", schema })).resolves.toEqual({ answer: 0.5 });
    expect(m.calls.map((c) => c.task)).toEqual(["score", "dynamic"]);
    await expect(m.healthCheck()).resolves.toMatchObject({ available: true, provider: "mock" });
  });

  it("rejects responses that violate the schema", async () => {
    const m = new MockReasoner({ responses: { score: { answer: 3 } } });
    const err = await m.runStructured({ task: "score", system: "s", prompt: "p", schema }).catch((e) => e);
    expect(err).toBeInstanceOf(ReasonerError);
    expect((err as ReasonerError).kind).toBe("invalid_output");
  });

  it("simulates an unavailable provider and unknown tasks", async () => {
    const m = new MockReasoner({ unavailable: true, responses: { score: { answer: 0.1 } } });
    expect((await m.healthCheck()).available).toBe(false);
    await expect(m.runStructured({ task: "score", system: "s", prompt: "p", schema })).rejects.toMatchObject({ kind: "unavailable" });
    m.unavailable = false;
    await expect(m.runStructured({ task: "other", system: "s", prompt: "p", schema })).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("does not leak mutations between calls", async () => {
    const canned = { answer: 0.2 };
    const m = new MockReasoner({ responses: { score: canned } });
    const first = await m.runStructured({ task: "score", system: "s", prompt: "p", schema });
    first.answer = 0.9;
    await expect(m.runStructured({ task: "score", system: "s", prompt: "p", schema })).resolves.toEqual({ answer: 0.2 });
  });
});
