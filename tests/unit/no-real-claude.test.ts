import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { ClaudeSubscriptionReasoner, runProcess } from "../../lib/ai/claude-subscription";
import { GUARD_MARKER, REAL_CLAUDE_BLOCKED, startsRealClaude } from "../fixtures/no-real-claude.setup";

// SPEC.md §30 — the test setup blocks any real `claude` process, so no automated test can use the subscription.
// These tests are fail-safe: every command they try cannot reach an installed CLI even if the guard were
// missing (empty PATH, or a path that does not exist), so a broken guard fails them without using Claude.

describe("no real Claude in automated tests", () => {
  it("has the guard installed for this test run", () => {
    expect((globalThis as Record<symbol, unknown>)[GUARD_MARKER]).toBe(true);
  });

  it("blocks the default reasoner, which would otherwise start `claude` from PATH", async () => {
    const emptyPath = mkdtempSync(join(tmpdir(), "pcf-empty-path-"));
    try {
      const reasoner = new ClaudeSubscriptionReasoner({ cwd: tmpdir(), env: { PATH: emptyPath } });
      const schema = z.object({ ok: z.boolean() });
      await expect(reasoner.runStructured({ task: "t", system: "s", prompt: "p", schema })).rejects.toThrow(REAL_CLAUDE_BLOCKED);
      await expect(reasoner.healthCheck()).resolves.toMatchObject({ available: false, error: expect.stringContaining(REAL_CLAUDE_BLOCKED) });
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  it("blocks claude by path and by name regardless of case", async () => {
    for (const executable of ["/nonexistent-pcf-dir/bin/claude", "/nonexistent-pcf-dir/Claude.exe"]) {
      await expect(runProcess({ executable, args: ["--version"], stdin: "", env: {}, cwd: tmpdir(), timeoutMs: 1000 })).rejects.toThrow(
        REAL_CLAUDE_BLOCKED,
      );
    }
  });

  it("recognises shell command strings and shell -c scripts that start claude", () => {
    expect(startsRealClaude("claude -p hello", undefined)).toBe(true);
    expect(startsRealClaude("  /usr/local/bin/claude --version", undefined)).toBe(true);
    expect(startsRealClaude("/bin/sh", ["-c", "claude -p x"])).toBe(true);
    expect(startsRealClaude("bash", ["-lc", "claude"])).toBe(true);
    expect(startsRealClaude("node", ["tests/fixtures/fake-claude.mjs"])).toBe(false);
    expect(startsRealClaude("/path/to/fake-claude.mjs", ["-p"])).toBe(false);
    expect(startsRealClaude("echo claude", undefined)).toBe(false);
  });
});
