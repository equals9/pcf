/**
 * SPEC.md §16 Preflight. Checks, in order:
 *   1. claude exists on PATH
 *   2. claude --version succeeds
 *   3. a non-interactive structured test invocation succeeds (uses the Claude subscription once)
 *   4. the database directory is writable
 *   5. SQLite migration succeeds
 * It never reads, prints, or inspects credentials.
 */
import { accessSync, constants, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { ClaudeSubscriptionReasoner, type EnvMap } from "../lib/ai/claude-subscription";
import { ReasonerError } from "../lib/ai/reasoner";
import { DEFAULT_DB_PATH, openDatabase } from "../lib/db/database";
import { runMigrations } from "../lib/db/migrations";

export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface PreflightOptions {
  executable?: string;
  dbPath?: string;
  env?: EnvMap;
  timeoutMs?: number;
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve an executable name against PATH (or accept an explicit path). */
export function findExecutable(executable: string, pathVar: string | undefined): string | null {
  if (executable.includes("/")) {
    const full = isAbsolute(executable) ? executable : resolve(executable);
    return isExecutableFile(full) ? full : null;
  }
  for (const dir of (pathVar ?? "").split(delimiter).filter(Boolean)) {
    const candidate = join(dir, executable);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

const preflightSchema = z.object({ ok: z.boolean() });

export async function runPreflight(options: PreflightOptions = {}): Promise<PreflightCheck[]> {
  const env = options.env ?? process.env;
  const executable = options.executable ?? "claude";
  const dbPath = options.dbPath ?? env.PCF_DB_PATH ?? DEFAULT_DB_PATH;
  const checks: PreflightCheck[] = [];

  const found = findExecutable(executable, env.PATH);
  checks.push({ name: "claude on PATH", ok: found !== null, detail: found ?? `${executable} not found on PATH` });

  const reasoner = new ClaudeSubscriptionReasoner({ executable: found ?? executable, env, defaultTimeoutMs: options.timeoutMs });
  if (found) {
    const health = await reasoner.healthCheck();
    checks.push({ name: "claude --version", ok: health.available, detail: health.available ? (health.version ?? "ok") : (health.error ?? "failed") });

    if (health.available) {
      try {
        const out = await reasoner.runStructured({
          task: "preflight",
          system: "You are a connectivity check. Respond only with the requested JSON.",
          prompt: 'Return JSON with "ok" set to true.',
          schema: preflightSchema,
        });
        checks.push({ name: "non-interactive invocation", ok: out.ok === true, detail: out.ok ? "structured response received" : "response had ok=false" });
      } catch (err) {
        const detail = err instanceof ReasonerError ? `${err.kind}: ${err.message}` : String(err);
        checks.push({ name: "non-interactive invocation", ok: false, detail });
      }
    } else {
      checks.push({ name: "non-interactive invocation", ok: false, detail: "skipped: claude --version failed" });
    }
  } else {
    checks.push({ name: "claude --version", ok: false, detail: "skipped: claude not found" });
    checks.push({ name: "non-interactive invocation", ok: false, detail: "skipped: claude not found" });
  }

  const dir = dirname(dbPath);
  let dirOk = false;
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.pcf-preflight-${process.pid}`);
    writeFileSync(probe, "ok");
    rmSync(probe);
    dirOk = true;
    checks.push({ name: "database directory writable", ok: true, detail: resolve(dir) });
  } catch (err) {
    checks.push({ name: "database directory writable", ok: false, detail: `${resolve(dir)}: ${(err as Error).message}` });
  }

  if (dirOk) {
    try {
      const db = openDatabase(dbPath);
      try {
        const res = runMigrations(db);
        checks.push({ name: "SQLite migration", ok: true, detail: `applied: ${res.applied.join(", ") || "none"}; already applied: ${res.skipped.join(", ") || "none"}` });
      } finally {
        db.close();
      }
    } catch (err) {
      checks.push({ name: "SQLite migration", ok: false, detail: (err as Error).message });
    }
  } else {
    checks.push({ name: "SQLite migration", ok: false, detail: "skipped: database directory not writable" });
  }

  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPreflight().then((checks) => {
    for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
    const failed = checks.filter((c) => !c.ok).length;
    console.log(failed ? `\npreflight failed: ${failed} check(s)` : "\npreflight passed");
    process.exitCode = failed ? 1 : 0;
  });
}
