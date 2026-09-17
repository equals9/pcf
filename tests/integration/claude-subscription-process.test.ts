import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ClaudeSubscriptionReasoner, KILL_GRACE_MS, defaultReasonerCwd, isPrivateDir, runProcess, type EnvMap } from "../../lib/ai/claude-subscription";
import { ReasonerError } from "../../lib/ai/reasoner";

// Real child processes against tests/fixtures/fake-claude.mjs. No Claude subscription usage.
const FAKE = join(__dirname, "..", "fixtures", "fake-claude.mjs");
const schema = z.object({ ok: z.boolean(), label: z.string() });

let state: string;
beforeEach(() => {
  state = mkdtempSync(join(tmpdir(), "pcf-fake-claude-"));
});
afterEach(() => {
  for (const name of ["pid", "orphan-pid"]) {
    const file = join(state, name);
    if (!existsSync(file)) continue;
    try {
      process.kill(Number(readFileSync(file, "utf8")), "SIGKILL");
    } catch {
      // already gone
    }
  }
  rmSync(state, { recursive: true, force: true });
});

function reasoner(mode: string, extra: { defaultTimeoutMs?: number; executable?: string; env?: EnvMap } = {}) {
  return new ClaudeSubscriptionReasoner({
    executable: extra.executable ?? FAKE,
    defaultTimeoutMs: extra.defaultTimeoutMs ?? 10_000,
    env: { ...process.env, FAKE_CLAUDE_MODE: mode, FAKE_CLAUDE_STATE_DIR: state, ...extra.env },
  });
}

type Call = { call: number; args: string[]; stdin: string; cwd: string; hasApiKey: boolean; maxStructuredOutputRetries: string | null; keepMe: string | null; start: number };
function calls(): Call[] {
  return readFileSync(join(state, "calls.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("ClaudeSubscriptionReasoner against a fake claude executable", () => {
  it("passes the documented flags, strips the API key, pins CLI retries, keeps other env, and uses stdin", async () => {
    const r = reasoner("ok", { env: { ANTHROPIC_API_KEY: "sk-test-not-real", FAKE_CLAUDE_KEEP_ME: "kept" } });
    await expect(r.runStructured({ task: "t", system: "SYS PROMPT", prompt: "hello prompt", schema })).resolves.toEqual({ ok: true, label: "fake" });
    const [c] = calls();
    expect(c.hasApiKey).toBe(false);
    expect(c.maxStructuredOutputRetries).toBe("1");
    expect(c.keepMe).toBe("kept");
    expect(c.stdin).toBe("hello prompt");
    expect(c.args).not.toContain("hello prompt");
    expect(c.args[0]).toBe("-p");
    expect(c.args[c.args.indexOf("--output-format") + 1]).toBe("json");
    expect(c.args[c.args.indexOf("--system-prompt") + 1]).toBe("SYS PROMPT");
    expect(c.args[c.args.indexOf("--tools") + 1]).toBe("");
    expect(JSON.parse(c.args[c.args.indexOf("--json-schema") + 1]).required).toEqual(["ok", "label"]);
    for (const flag of ["--no-session-persistence", "--strict-mcp-config", "--disable-slash-commands", "--safe-mode"]) expect(c.args).toContain(flag);
    for (const banned of ["--model", "--bare"]) expect(c.args).not.toContain(banned);
  });

  it("runs the CLI in a private directory under the temp dir, not the shared temp dir", async () => {
    await reasoner("ok").runStructured({ task: "t", system: "S", prompt: "P", schema });
    const cwd = realpathSync(calls()[0].cwd);
    expect(cwd).toBe(realpathSync(defaultReasonerCwd()));
    expect(cwd).not.toBe(realpathSync(tmpdir()));
    expect(dirname(cwd)).toBe(realpathSync(tmpdir()));
    expect(cwd.endsWith(`pcf-reasoner-${process.getuid!()}`)).toBe(true);
    expect(statSync(cwd).mode & 0o777).toBe(0o700);
  });

  describe("private working directory selection (subprocess probes)", () => {
    const PROBE = join(__dirname, "..", "fixtures", "reasoner-cwd-probe.mjs");
    const probe = (tmp: string, extra: Record<string, string> = {}) =>
      JSON.parse(execFileSync(process.execPath, ["--import", "tsx", PROBE], { encoding: "utf8", env: { ...process.env, TMPDIR: tmp, ...extra } }).trim());
    const uid = process.getuid!();

    it("uses and reuses <tmpdir>/pcf-reasoner-<uid> when it is private", () => {
      const tmp = join(state, "clean");
      mkdirSync(tmp);
      const { first, second } = probe(tmp);
      expect(first).toBe(join(tmp, `pcf-reasoner-${uid}`));
      expect(second).toBe(first);
      expect(statSync(first).mode & 0o777).toBe(0o700);
    });

    it("falls back when the per-user path is open to others", () => {
      const tmp = join(state, "open");
      mkdirSync(join(tmp, `pcf-reasoner-${uid}`), { recursive: true });
      chmodSync(join(tmp, `pcf-reasoner-${uid}`), 0o777);
      const { first, second } = probe(tmp);
      expect(first).not.toBe(join(tmp, `pcf-reasoner-${uid}`));
      expect(dirname(first)).toBe(tmp);
      expect(statSync(first).mode & 0o777).toBe(0o700);
      expect(second).toBe(first);
    });

    it("falls back when the per-user path is a symlink", () => {
      const tmp = join(state, "linked");
      const target = join(state, "target");
      mkdirSync(tmp);
      mkdirSync(target, { mode: 0o700 });
      symlinkSync(target, join(tmp, `pcf-reasoner-${uid}`));
      const { first } = probe(tmp);
      expect(first).not.toBe(join(tmp, `pcf-reasoner-${uid}`));
      expect(isPrivateDir(first)).toBe(true);
    });

    it("falls back when the per-user path is owned by another user", () => {
      const otherUid = uid + 12345;
      const tmp = join(state, "foreign");
      mkdirSync(join(tmp, `pcf-reasoner-${otherUid}`), { recursive: true, mode: 0o700 });
      chmodSync(join(tmp, `pcf-reasoner-${otherUid}`), 0o700);
      // The probe claims to be otherUid, so the directory (really owned by uid) looks foreign to it.
      const { first, second } = probe(tmp, { PROBE_UID: String(otherUid) });
      expect(first).not.toBe(join(tmp, `pcf-reasoner-${otherUid}`));
      expect(dirname(first)).toBe(tmp);
      expect(second).toBe(first);
    });

    it("reuses one directory on platforms without uids, ignoring mode bits", () => {
      const tmp = join(state, "nouid");
      mkdirSync(join(tmp, "pcf-reasoner-user"), { recursive: true });
      chmodSync(join(tmp, "pcf-reasoner-user"), 0o755);
      const { first, second } = probe(tmp, { PROBE_UID: "none" });
      expect(first).toBe(join(tmp, "pcf-reasoner-user"));
      expect(second).toBe(first);
    });

    it("reports an unusable temp dir as unavailable without spawning claude", () => {
      const out = probe(state, { PROBE_ACTION: "fail", PROBE_TMPDIR: join(state, "does-not-exist") });
      expect(out.isReasonerError).toBe(true);
      expect(out.name).toBe("ReasonerError");
      expect(out.kind).toBe("unavailable");
      expect(out.message).toMatch(/^could not prepare a private working directory: /);
      expect(out.logs).toEqual([{ task: "probe", attempt: 1, durationMs: 0, outcome: "unavailable" }]);
      expect(out.health.available).toBe(false);
      expect(out.health.error).toMatch(/^could not prepare a private working directory: /);
    });
  });

  it("accepts JSON in the result text when structured_output is absent", async () => {
    await expect(reasoner("result_text_only").runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: true, label: "fake" });
  });

  it("retries once after invalid output and succeeds", async () => {
    await expect(reasoner("invalid_then_ok").runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: true, label: "fake" });
    const cs = calls();
    expect(cs).toHaveLength(2);
    expect(cs[1].stdin).toContain("did not satisfy the required JSON schema");
  });

  it("retries once after the CLI's own schema check gives up, then succeeds", async () => {
    await expect(reasoner("schema_exhausted_then_ok").runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: true, label: "fake" });
    const cs = calls();
    expect(cs).toHaveLength(2);
    expect(cs[1].stdin).toContain("last StructuredOutput error: label: expected string");
  });

  it("reports repeated CLI schema rejection as invalid_output after one retry", async () => {
    const err = await reasoner("schema_exhausted").runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect((err as ReasonerError).kind).toBe("invalid_output");
    expect(calls()).toHaveLength(2);
  });

  it("gives up after one retry", async () => {
    const err = await reasoner("always_invalid").runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect((err as ReasonerError).kind).toBe("invalid_output");
    expect(calls()).toHaveLength(2);
  });

  it("classifies provider errors and non-zero exits as unavailable without retry", async () => {
    for (const mode of ["provider_error", "exit_nonzero"]) {
      rmSync(state, { recursive: true, force: true });
      state = mkdtempSync(join(tmpdir(), "pcf-fake-claude-"));
      const err = await reasoner(mode).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
      expect((err as ReasonerError).kind).toBe("unavailable");
      expect(calls()).toHaveLength(1);
      if (mode === "provider_error") expect((err as ReasonerError).message).toContain("issue with the selected model");
    }
  });

  it("kills a hung process at the timeout", async () => {
    const started = Date.now();
    const err = await reasoner("hang", { defaultTimeoutMs: 1_000 }).runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect((err as ReasonerError).kind).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(1_000 + KILL_GRACE_MS);
    expect(alive(Number(readFileSync(join(state, "pid"), "utf8")))).toBe(false);
  });

  it("escalates to SIGKILL when the process ignores SIGTERM", async () => {
    const res = await runProcess({
      executable: FAKE,
      args: ["-p"],
      stdin: "x",
      env: { ...process.env, FAKE_CLAUDE_MODE: "hang_ignore_term", FAKE_CLAUDE_STATE_DIR: state },
      cwd: tmpdir(),
      timeoutMs: 1_000,
    });
    expect(res.timedOut).toBe(true);
    expect(res.signal).toBe("SIGKILL");
    expect(alive(Number(readFileSync(join(state, "pid"), "utf8")))).toBe(false);
  }, 15_000);

  it("settles after the kill grace even when another process keeps the output pipes open", async () => {
    const started = Date.now();
    const res = await runProcess({
      executable: FAKE,
      args: ["-p"],
      stdin: "x",
      env: { ...process.env, FAKE_CLAUDE_MODE: "orphan_holds_stdout", FAKE_CLAUDE_STATE_DIR: state },
      cwd: tmpdir(),
      timeoutMs: 1_000,
    });
    const elapsed = Date.now() - started;
    expect(res.timedOut).toBe(true);
    expect(res.signal).toBe("SIGKILL");
    expect(elapsed).toBeLessThan(1_000 + 2 * KILL_GRACE_MS + 2_000);
    expect(alive(Number(readFileSync(join(state, "pid"), "utf8")))).toBe(false);
  }, 20_000);

  it("returns a clean result promptly when the CLI exits while another process holds its pipes", async () => {
    const started = Date.now();
    const r = reasoner("exit_with_orphan", { defaultTimeoutMs: 10_000 });
    await expect(r.runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: true, label: "fake" });
    expect(Date.now() - started).toBeLessThan(KILL_GRACE_MS + 2_000);
    expect(existsSync(join(state, "orphan-pid"))).toBe(true);
  }, 15_000);

  it("does not report a timeout when the deadline passes after a clean exit", async () => {
    // The CLI exits well before the 1.2 s deadline, but the held pipes delay settling until exit + KILL_GRACE_MS.
    const r = reasoner("exit_with_orphan", { defaultTimeoutMs: 1_200 });
    await expect(r.runStructured({ task: "t", system: "S", prompt: "P", schema })).resolves.toEqual({ ok: true, label: "fake" });
  }, 15_000);

  it("reports a missing executable as unavailable", async () => {
    const r = reasoner("ok", { executable: join(state, "no-such-claude") });
    const err = await r.runStructured({ task: "t", system: "S", prompt: "P", schema }).catch((e) => e);
    expect((err as ReasonerError).kind).toBe("unavailable");
    expect((await r.healthCheck()).available).toBe(false);
  });

  it("health check reads the version and reports failures", async () => {
    await expect(reasoner("ok").healthCheck()).resolves.toMatchObject({ available: true, version: "9.9.9 (Fake Claude Code)" });
    await expect(reasoner("version_fail").healthCheck()).resolves.toMatchObject({ available: false });
  });

  it("never overlaps concurrent invocations", async () => {
    const a = reasoner("slow_ok");
    const b = reasoner("slow_ok");
    await Promise.all([1, 2, 3].map((i) => (i % 2 ? a : b).runStructured({ task: "t", system: "S", prompt: String(i), schema })));
    const starts = calls().map((c) => c.start);
    const ends = readFileSync(join(state, "ends.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).end as number);
    expect(starts).toHaveLength(3);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThanOrEqual(ends[i - 1]);
  });
});

describe("runProcess", () => {
  it("captures stdout and stderr separately", async () => {
    const res = await runProcess({ executable: FAKE, args: ["-p"], stdin: "x", env: { ...process.env, FAKE_CLAUDE_MODE: "ok" }, cwd: tmpdir(), timeoutMs: 10_000 });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('"structured_output"');
    expect(res.stdout).not.toContain("fake stderr line");
    expect(res.stderr).toBe("fake stderr line\n");
  });
});
