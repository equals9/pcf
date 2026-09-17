import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ClaudeSubscriptionReasoner,
  buildChildEnv,
  buildRetryPrompt,
  buildStructuredArgs,
  type ProcessRequest,
  type ProcessResult,
} from "../../lib/ai/claude-subscription";
import { ReasonerError } from "../../lib/ai/reasoner";
import { toJsonSchema } from "../../lib/ai/structured-output";

const schema = z.object({ ok: z.boolean() });
const envelope = (fields: Record<string, unknown>) => JSON.stringify({ type: "result", subtype: "success", is_error: false, ...fields });
const exhausted = (msg: string) => JSON.stringify({ type: "result", subtype: "error_max_structured_output_retries", is_error: true, errors: [msg] });
const result = (over: Partial<ProcessResult>): ProcessResult => ({ exitCode: 0, signal: null, stdout: "", stderr: "", timedOut: false, spawnError: null, ...over });

function scripted(results: ProcessResult[]) {
  const requests: ProcessRequest[] = [];
  const run = async (req: ProcessRequest) => {
    requests.push(req);
    const next = results.shift();
    if (!next) throw new Error("no scripted result left");
    return next;
  };
  return { run, requests };
}

describe("buildChildEnv", () => {
  it("removes ANTHROPIC_API_KEY, pins the CLI structured-output attempts to 1, and preserves everything else", () => {
    const parent = {
      ANTHROPIC_API_KEY: "sk-test-not-real",
      HOME: "/home/x",
      PATH: "/bin",
      ANTHROPIC_BASE_URL: "http://proxy",
      CLAUDE_CONFIG_DIR: "/cfg",
      MAX_STRUCTURED_OUTPUT_RETRIES: "9",
    };
    const env = buildChildEnv(parent);
    expect(env).toEqual({ HOME: "/home/x", PATH: "/bin", ANTHROPIC_BASE_URL: "http://proxy", CLAUDE_CONFIG_DIR: "/cfg", MAX_STRUCTURED_OUTPUT_RETRIES: "1" });
    expect(parent.ANTHROPIC_API_KEY).toBe("sk-test-not-real");
    expect(parent.MAX_STRUCTURED_OUTPUT_RETRIES).toBe("9");
  });
});

describe("buildStructuredArgs", () => {
  it("uses documented print-mode flags, no model flag, and no prompt in argv", () => {
    const args = buildStructuredArgs("SYSTEM", { type: "object" });
    expect(args).toEqual([
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      '{"type":"object"}',
      "--system-prompt",
      "SYSTEM",
      "--tools",
      "",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--safe-mode",
    ]);
  });
});

describe("ClaudeSubscriptionReasoner (scripted process)", () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it("passes exactly the documented flags, sends the prompt on stdin, and returns validated output", async () => {
    const { run, requests } = scripted([result({ stdout: envelope({ structured_output: { ok: true, extra: 1 } }) })]);
    const reasoner = new ClaudeSubscriptionReasoner({ run, env: { ANTHROPIC_API_KEY: "sk-test-not-real", PATH: "/bin" }, cwd: "/neutral" });
    await expect(reasoner.runStructured({ task: "t", system: "S", prompt: "PROMPT", schema })).resolves.toEqual({ ok: true });
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req.args).toEqual(buildStructuredArgs("S", toJsonSchema(schema)));
    for (const banned of ["--model", "--bare", "PROMPT"]) expect(req.args).not.toContain(banned);
    expect(req.stdin).toBe("PROMPT");
    expect(req.env).toEqual({ PATH: "/bin", MAX_STRUCTURED_OUTPUT_RETRIES: "1" });
    expect(req.cwd).toBe("/neutral");
    expect(req.executable).toBe("claude");
  });

  it("strips the API key when built with the default process environment", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
    const { run, requests } = scripted([result({ stdout: envelope({ structured_output: { ok: true } }) })]);
    await new ClaudeSubscriptionReasoner({ run }).runStructured({ task: "t", system: "S", prompt: "P", schema });
    expect(requests[0].env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(requests[0].env.PATH).toBe(process.env.PATH);
    expect(requests[0].env.MAX_STRUCTURED_OUTPUT_RETRIES).toBe("1");
    expect(process.env.ANTHROPIC_API_KEY).toBe("sk-test-not-real");
  });

  it("uses the per-call timeout, falling back to the configured default", async () => {
    const { run, requests } = scripted([result({ stdout: envelope({ structured_output: { ok: true } }) }), result({ stdout: envelope({ structured_output: { ok: true } }) })]);
    const reasoner = new ClaudeSubscriptionReasoner({ run, defaultTimeoutMs: 1234, cwd: "/n" });
    await reasoner.runStructured({ task: "t", system: "S", prompt: "P", schema });
    await reasoner.runStructured({ task: "t", system: "S", prompt: "P", schema, timeoutMs: 99 });
    expect(requests.map((r) => r.timeoutMs)).toEqual([1234, 99]);
  });

  it("retries malformed output exactly once with the validation errors", async () => {
    const { run, requests } = scripted([
      result({ stdout: envelope({ structured_output: { ok: "yes" } }) }),
      result({ stdout: envelope({ structured_output: { ok: false } }) }),
    ]);
    const logs: string[] = [];
    const reasoner = new ClaudeSubscriptionReasoner({ run, cwd: "/n", log: (e) => logs.push(`${e.attempt}:${e.outcome}`) });
    await expect(reasoner.runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: false });
    expect(requests).toHaveLength(2);
    expect(requests[1].stdin).toBe(buildRetryPrompt("P", ["ok: Invalid input: expected boolean, received string"]));
    expect(requests[1].args).toEqual(requests[0].args);
    expect(logs).toEqual(["1:invalid_output", "2:ok"]);
  });

  it("treats the CLI's schema-retry exhaustion as invalid output and uses the single retry", async () => {
    const { run, requests } = scripted([
      result({ exitCode: 1, stdout: exhausted("last StructuredOutput error: ok must be boolean") }),
      result({ stdout: envelope({ structured_output: { ok: true } }) }),
    ]);
    await expect(new ClaudeSubscriptionReasoner({ run, cwd: "/n" }).runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: true });
    expect(requests).toHaveLength(2);
    expect(requests[1].stdin).toContain("- last StructuredOutput error: ok must be boolean");

    const twice = scripted([result({ exitCode: 1, stdout: exhausted("a") }), result({ exitCode: 1, stdout: exhausted("b") })]);
    const err = await new ClaudeSubscriptionReasoner({ run: twice.run, cwd: "/n" }).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect(err).toBeInstanceOf(ReasonerError);
    expect((err as ReasonerError).kind).toBe("invalid_output");
    expect((err as ReasonerError).details.issues).toEqual(["b"]);
    expect(twice.requests).toHaveLength(2);
  });

  it("bounds issue text in the retry prompt and in error details", async () => {
    const huge = "x".repeat(2_000);
    const many = Array.from({ length: 30 }, (_, i) => `issue ${i} ${huge}`);
    const prompt = buildRetryPrompt("P", many);
    expect(prompt.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(20);
    expect(prompt.length).toBeLessThan(20 * 520 + 300);

    const env = JSON.stringify({ type: "result", subtype: "error_max_structured_output_retries", is_error: true, errors: many });
    const { run } = scripted([result({ exitCode: 1, stdout: env }), result({ exitCode: 1, stdout: env })]);
    const err = (await new ClaudeSubscriptionReasoner({ run, cwd: "/n" }).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e)) as ReasonerError;
    const issues = err.details.issues as string[];
    expect(issues).toHaveLength(20);
    for (const i of issues) expect(i.length).toBeLessThanOrEqual(501);
  });

  it("limits invalid structured output to two CLI invocations, each capped at one CLI attempt", async () => {
    // Three invalid responses are queued, so a third invocation would be possible if the limit were broken.
    const invalid = () => result({ stdout: envelope({ structured_output: { ok: "not a boolean" } }) });
    const { run, requests } = scripted([invalid(), invalid(), invalid()]);
    const err = await new ClaudeSubscriptionReasoner({ run, cwd: "/n" }).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect((err as ReasonerError).kind).toBe("invalid_output");
    expect(requests).toHaveLength(2);
    expect(requests.map((r) => r.env.MAX_STRUCTURED_OUTPUT_RETRIES)).toEqual(["1", "1"]);
  });

  it("fails with invalid_output after the single retry", async () => {
    const bad = result({ stdout: "not json" });
    const { run, requests } = scripted([bad, { ...bad }]);
    const err = await new ClaudeSubscriptionReasoner({ run, cwd: "/n" }).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect(err).toBeInstanceOf(ReasonerError);
    expect((err as ReasonerError).kind).toBe("invalid_output");
    expect(requests).toHaveLength(2);
  });

  it("treats is_error as unavailable even with exit code 0, keeping the provider message", async () => {
    const { run, requests } = scripted([result({ exitCode: 0, stdout: envelope({ is_error: true, result: "usage limit reached", structured_output: { ok: true } }) })]);
    const err = await new ClaudeSubscriptionReasoner({ run, cwd: "/n" }).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect((err as ReasonerError).kind).toBe("unavailable");
    expect((err as ReasonerError).message).toContain("usage limit reached");
    expect(requests).toHaveLength(1);
  });

  it("does not retry provider errors, non-zero exits, timeouts, or missing executables", async () => {
    const cases: Array<[ProcessResult, string]> = [
      [result({ exitCode: 1, stdout: envelope({ is_error: true, result: "rate limited" }) }), "unavailable"],
      [result({ exitCode: 2, stdout: envelope({ structured_output: { ok: true } }) }), "unavailable"],
      [result({ exitCode: 2, stdout: "" }), "unavailable"],
      [result({ exitCode: null, signal: "SIGTERM", timedOut: true }), "timeout"],
      [result({ exitCode: null, spawnError: Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }) }), "unavailable"],
    ];
    for (const [res, kind] of cases) {
      const { run, requests } = scripted([res]);
      const err = await new ClaudeSubscriptionReasoner({ run, cwd: "/n" }).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
      expect((err as ReasonerError).kind).toBe(kind);
      expect(requests).toHaveLength(1);
    }
  });

  it("reports health from claude --version without a model call", async () => {
    const ok = scripted([result({ stdout: "2.1.273 (Claude Code)\n" })]);
    await expect(new ClaudeSubscriptionReasoner({ run: ok.run, cwd: "/n" }).healthCheck()).resolves.toEqual({ available: true, provider: "claude-subscription", version: "2.1.273 (Claude Code)", error: null });
    expect(ok.requests[0].args).toEqual(["--version"]);

    const missing = scripted([result({ exitCode: null, spawnError: Object.assign(new Error("ENOENT"), { code: "ENOENT" }) })]);
    const h = await new ClaudeSubscriptionReasoner({ run: missing.run, cwd: "/n" }).healthCheck();
    expect(h.available).toBe(false);
    expect(h.error).toMatch(/not found/);
  });

  it("serializes concurrent calls (concurrency 1)", async () => {
    let active = 0;
    let maxActive = 0;
    const run = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return result({ stdout: envelope({ structured_output: { ok: true } }) });
    };
    const a = new ClaudeSubscriptionReasoner({ run, cwd: "/n" });
    const b = new ClaudeSubscriptionReasoner({ run, cwd: "/n" });
    await Promise.all([
      a.runStructured({ task: "t", system: "S", prompt: "1", schema }),
      b.runStructured({ task: "t", system: "S", prompt: "2", schema }),
      a.runStructured({ task: "t", system: "S", prompt: "3", schema }),
    ]);
    expect(maxActive).toBe(1);
  });

  it("keeps the queue usable after a failed call", async () => {
    const { run } = scripted([result({ exitCode: 2 }), result({ stdout: envelope({ structured_output: { ok: true } }) })]);
    const reasoner = new ClaudeSubscriptionReasoner({ run, cwd: "/n" });
    await expect(reasoner.runStructured({ task: "t", system: "S", prompt: "P", schema })).rejects.toBeInstanceOf(ReasonerError);
    await expect(reasoner.runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: true });
  });
});
