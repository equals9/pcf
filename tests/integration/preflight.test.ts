import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findExecutable, runPreflight } from "../../scripts/preflight";

const FAKE = join(__dirname, "..", "fixtures", "fake-claude.mjs");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pcf-preflight-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("findExecutable", () => {
  it("resolves names on PATH and explicit paths, ignoring non-executables", () => {
    const bin = join(dir, "bin");
    const exe = join(bin, "claude");
    const plain = join(bin, "not-exec");
    mkdirSync(bin);
    writeFileSync(exe, "#!/bin/sh\n");
    chmodSync(exe, 0o755);
    writeFileSync(plain, "x");
    expect(findExecutable("claude", `/nonexistent:${bin}`)).toBe(exe);
    expect(findExecutable("not-exec", bin)).toBeNull();
    expect(findExecutable("claude", "")).toBeNull();
    expect(findExecutable(exe, undefined)).toBe(exe);
  });
});

describe("runPreflight (fake claude, no subscription usage)", () => {
  it("passes all five checks and migrates the database", async () => {
    const checks = await runPreflight({
      executable: FAKE,
      dbPath: join(dir, "data", "pcf.db"),
      env: { ...process.env, FAKE_CLAUDE_MODE: "ok" },
    });
    expect(checks.map((c) => c.name)).toEqual([
      "claude on PATH",
      "claude --version",
      "non-interactive invocation",
      "database directory writable",
      "SQLite migration",
    ]);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(checks[4].detail).toContain("001_initial.sql");
  });

  it("reports each failing check without throwing", async () => {
    const missing = await runPreflight({ executable: "pcf-no-such-claude", dbPath: join(dir, "data", "pcf.db"), env: { PATH: dir } });
    expect(missing.slice(0, 3).map((c) => c.ok)).toEqual([false, false, false]);
    expect(missing.slice(3).map((c) => c.ok)).toEqual([true, true]);

    const providerError = await runPreflight({ executable: FAKE, dbPath: join(dir, "data2", "pcf.db"), env: { ...process.env, FAKE_CLAUDE_MODE: "provider_error" } });
    expect(providerError.map((c) => c.ok)).toEqual([true, true, false, true, true]);
    expect(providerError[2].detail).toMatch(/^unavailable:/);
    expect(providerError[2].detail).toContain("issue with the selected model");

    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "file, not a directory");
    const unwritable = await runPreflight({ executable: FAKE, dbPath: join(blocker, "pcf.db"), env: { ...process.env, FAKE_CLAUDE_MODE: "ok" } });
    expect(unwritable.slice(3).map((c) => c.ok)).toEqual([false, false]);
  });
});
