import { vi } from "vitest";

// SPEC.md §30 — automated tests must never consume Claude subscription usage.
// Starting a process whose command is `claude` / `claude.exe` (by name or path), or a shell command whose
// first word is one of those, fails immediately. Fake CLIs with other names are unaffected.
export const REAL_CLAUDE_BLOCKED = "real claude invocation blocked in automated tests";
export const GUARD_MARKER = Symbol.for("pcf.noRealClaudeGuard");

const CLAUDE = /(^|[\\/])claude(\.exe)?$/i;
const SHELL = /(^|[\\/])(sh|bash|zsh|dash|fish|cmd(\.exe)?|powershell(\.exe)?|pwsh(\.exe)?)$/i;

function firstWord(command: string): string {
  return command.trim().split(/\s+/)[0] ?? "";
}

export function startsRealClaude(command: unknown, args: unknown): boolean {
  if (typeof command !== "string") return false;
  if (CLAUDE.test(command) || CLAUDE.test(firstWord(command))) return true;
  if (SHELL.test(firstWord(command)) && Array.isArray(args)) {
    return args.some((a) => typeof a === "string" && CLAUDE.test(firstWord(a)));
  }
  return false;
}

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const guard = <F extends (...args: never[]) => unknown>(fn: F): F =>
    ((command: unknown, ...rest: unknown[]) => {
      if (startsRealClaude(command, rest[0])) throw new Error(REAL_CLAUDE_BLOCKED);
      return (fn as unknown as (...a: unknown[]) => unknown)(command, ...rest);
    }) as unknown as F;
  const patched = {
    ...actual,
    spawn: guard(actual.spawn),
    spawnSync: guard(actual.spawnSync),
    exec: guard(actual.exec),
    execSync: guard(actual.execSync),
    execFile: guard(actual.execFile),
    execFileSync: guard(actual.execFileSync),
  };
  (globalThis as Record<symbol, unknown>)[GUARD_MARKER] = true;
  return { ...patched, default: patched };
});
