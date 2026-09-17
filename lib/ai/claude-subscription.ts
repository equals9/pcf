import { spawn } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Reasoner, ReasonerHealth, RunStructuredInput } from "./reasoner";
import { ReasonerError } from "./reasoner";
import { readClaudeEnvelope, toJsonSchema, validateStructured } from "./structured-output";

// SPEC.md §16 — ClaudeSubscriptionReasoner.
// Invokes the installed, authenticated Claude Code CLI in print mode. No Anthropic SDK, no HTTP calls.
// Flags and environment variables were checked against `claude --help` and the Claude Code docs
// (cli-reference, headless, env-vars) for Claude Code 2.1.273; see BUILD_STATUS.md.

/** Environment variables removed from the child process. Everything else is inherited unchanged. */
export const STRIPPED_ENV_VARS = ["ANTHROPIC_API_KEY"] as const;

/**
 * Documented Claude Code env var: attempts allowed when output fails --json-schema in -p mode (default 5).
 * Pinned to 1 so the adapter's single retry is the only retry (SPEC §16 item 12).
 */
export const CLI_STRUCTURED_OUTPUT_ATTEMPTS = { name: "MAX_STRUCTURED_OUTPUT_RETRIES", value: "1" } as const;

export const DEFAULT_TIMEOUT_MS = 120_000;
export const KILL_GRACE_MS = 2_000;
const HEALTH_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const STDERR_SNIPPET_CHARS = 500;

/** Plain environment map (Next.js narrows NodeJS.ProcessEnv to require NODE_ENV). */
export type EnvMap = Record<string, string | undefined>;

export interface ProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError: NodeJS.ErrnoException | null;
}

export interface ProcessRequest {
  executable: string;
  args: string[];
  stdin: string;
  env: EnvMap;
  cwd: string;
  timeoutMs: number;
}

/**
 * Run a child process with separate stdout/stderr capture and a hard timeout.
 * On timeout: SIGTERM, then SIGKILL after KILL_GRACE_MS. Once the child has exited, the promise settles
 * within one further KILL_GRACE_MS even if another process still holds the output pipes.
 */
export function runProcess(req: ProcessRequest): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let timedOut = false;
    let spawnError: NodeJS.ErrnoException | null = null;
    let settled = false;
    const timers: NodeJS.Timeout[] = [];

    const child = spawn(req.executable, req.args, { cwd: req.cwd, env: req.env as NodeJS.ProcessEnv, stdio: ["pipe", "pipe", "pipe"] });
    const running = () => child.exitCode === null && child.signalCode === null;

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      resolve({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
        spawnError,
      });
    };

    // Settle even if another process still holds the output pipes, so "close" never fires.
    let forceScheduled = false;
    const scheduleForcedSettle = () => {
      if (forceScheduled) return;
      forceScheduled = true;
      timers.push(
        setTimeout(() => {
          child.stdout.destroy();
          child.stderr.destroy();
          finish(child.exitCode, child.signalCode);
        }, KILL_GRACE_MS),
      );
    };

    let killing = false;
    const kill = () => {
      if (killing) return;
      killing = true;
      if (running()) child.kill("SIGTERM");
      timers.push(
        setTimeout(() => {
          if (running()) child.kill("SIGKILL");
          scheduleForcedSettle();
        }, KILL_GRACE_MS),
      );
    };

    timers.push(
      setTimeout(() => {
        if (!running()) return; // exited already; the exit handler settles it
        timedOut = true;
        kill();
      }, req.timeoutMs),
    );

    const collect = (sink: Buffer[]) => (chunk: Buffer) => {
      if (bytes > MAX_OUTPUT_BYTES) return;
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) {
        kill();
        return;
      }
      sink.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));

    child.on("error", (err: NodeJS.ErrnoException) => {
      spawnError = err;
      finish(null, null);
    });
    child.on("exit", () => scheduleForcedSettle());
    child.on("close", (code, signal) => finish(code, signal));

    child.stdin.on("error", () => {
      // The child may exit before reading stdin (e.g. EPIPE); its exit status is reported via "close".
    });
    child.stdin.end(req.stdin);
  });
}

/** Copy of the parent environment without the API key (so the subscription login is used) and with the CLI retry cap. */
export function buildChildEnv(parent: EnvMap = process.env): EnvMap {
  const env: EnvMap = { ...parent };
  for (const name of STRIPPED_ENV_VARS) delete env[name];
  env[CLI_STRUCTURED_OUTPUT_ATTEMPTS.name] = CLI_STRUCTURED_OUTPUT_ATTEMPTS.value;
  return env;
}

/**
 * Print-mode arguments. The prompt is sent on stdin, not argv.
 * No --model flag: the user's Claude Code default model stays authoritative (SPEC §16).
 */
export function buildStructuredArgs(system: string, jsonSchema: Record<string, unknown>): string[] {
  return [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(jsonSchema),
    "--system-prompt",
    system,
    "--tools",
    "",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--safe-mode",
  ];
}

function snippet(text: string): string {
  return text.length > STDERR_SNIPPET_CHARS ? `${text.slice(0, STDERR_SNIPPET_CHARS)}…` : text;
}

const MAX_ISSUES = 20;

/** At most MAX_ISSUES issues, each at most STDERR_SNIPPET_CHARS characters. */
export function boundIssues(issues: string[]): string[] {
  return issues.slice(0, MAX_ISSUES).map(snippet);
}

export function buildRetryPrompt(prompt: string, issues: string[]): string {
  const listed = boundIssues(issues).map((i) => `- ${i}`).join("\n");
  return `${prompt}\n\nYour previous response did not satisfy the required JSON schema.\nValidation errors:\n${listed}\nReturn a corrected response that satisfies the schema exactly.`;
}

/**
 * Print mode skips Claude Code's workspace trust prompt, and the CLI docs say to use it only in trusted
 * directories. The child therefore runs in a per-user private directory under the temp dir
 * (`pcf-reasoner-<uid>`: a real directory owned by this user with no group/other permissions), never in
 * the shared temp dir or the repository. If that path exists but is not private (for example created by another user),
 * a fresh private directory is used instead.
 */
export function isPrivateDir(path: string): boolean {
  try {
    const st = lstatSync(path);
    if (!st.isDirectory() || st.isSymbolicLink()) return false;
    // Without POSIX uids (Windows) the per-user temp directory is already private; mode bits are not meaningful.
    if (typeof process.getuid !== "function") return true;
    return st.uid === process.getuid() && (st.mode & 0o077) === 0;
  } catch {
    return false;
  }
}

function isRealDir(path: string): boolean {
  try {
    const st = lstatSync(path);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

// The cached directory was verified (or created by mkdtemp, which is private by construction);
// other users cannot change its owner or mode, so later calls only confirm it still exists.
let privateCwd: string | null = null;
export function defaultReasonerCwd(): string {
  if (privateCwd !== null && isRealDir(privateCwd)) return privateCwd;
  const uid = typeof process.getuid === "function" ? process.getuid() : "user";
  const fixed = join(tmpdir(), `pcf-reasoner-${uid}`);
  try {
    mkdirSync(fixed, { mode: 0o700 });
  } catch {
    // Already exists (or cannot be created); verified below.
  }
  privateCwd = isPrivateDir(fixed) ? fixed : mkdtempSync(join(tmpdir(), "pcf-reasoner-"));
  return privateCwd;
}

// SPEC §16 item 13 — concurrency 1 for all model invocations in this process.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export interface ClaudeSubscriptionReasonerOptions {
  executable?: string;
  defaultTimeoutMs?: number;
  cwd?: string;
  env?: EnvMap;
  run?: (req: ProcessRequest) => Promise<ProcessResult>;
  log?: (entry: ReasonerLogEntry) => void;
}

/** SPEC §29 — operation name, duration, validation result, error type. Never prompts or credentials. */
export interface ReasonerLogEntry {
  task: string;
  attempt: number;
  durationMs: number;
  outcome: "ok" | "invalid_output" | "unavailable" | "timeout";
}

export class ClaudeSubscriptionReasoner implements Reasoner {
  private readonly executable: string;
  private readonly defaultTimeoutMs: number;
  private readonly cwd: string | undefined;
  private readonly env: EnvMap;
  private readonly run: (req: ProcessRequest) => Promise<ProcessResult>;
  private readonly log: (entry: ReasonerLogEntry) => void;

  constructor(options: ClaudeSubscriptionReasonerOptions = {}) {
    this.executable = options.executable ?? "claude";
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cwd = options.cwd;
    this.env = buildChildEnv(options.env ?? process.env);
    this.run = options.run ?? runProcess;
    this.log = options.log ?? (() => {});
  }

  private request(args: string[], stdin: string, timeoutMs: number, cwd: string): ProcessRequest {
    return { executable: this.executable, args, stdin, env: this.env, cwd, timeoutMs };
  }

  /** Throws a plain Error with a readable message when no private working directory can be prepared. */
  private prepareCwd(): string {
    try {
      return this.cwd ?? defaultReasonerCwd();
    } catch (err) {
      throw new Error(`could not prepare a private working directory: ${(err as Error).message}`);
    }
  }

  async healthCheck(): Promise<ReasonerHealth> {
    const base = { provider: "claude-subscription" };
    let res: ProcessResult;
    try {
      res = await this.run(this.request(["--version"], "", HEALTH_TIMEOUT_MS, this.prepareCwd()));
    } catch (err) {
      return { ...base, available: false, version: null, error: (err as Error).message };
    }
    if (res.spawnError) {
      const missing = res.spawnError.code === "ENOENT";
      return { ...base, available: false, version: null, error: missing ? "claude executable not found on PATH" : res.spawnError.message };
    }
    if (res.timedOut) return { ...base, available: false, version: null, error: "claude --version timed out" };
    if (res.exitCode !== 0) {
      return { ...base, available: false, version: null, error: `claude --version exited with code ${res.exitCode ?? res.signal}: ${snippet(res.stderr.trim())}` };
    }
    return { ...base, available: true, version: res.stdout.trim() || null, error: null };
  }

  runStructured<T>(input: RunStructuredInput<T>): Promise<T> {
    return serialize(() => this.runStructuredNow(input));
  }

  private async runStructuredNow<T>(input: RunStructuredInput<T>): Promise<T> {
    const { task, system, schema } = input;
    const timeoutMs = input.timeoutMs ?? this.defaultTimeoutMs;
    const args = buildStructuredArgs(system, toJsonSchema(schema));

    let cwd: string;
    try {
      cwd = this.prepareCwd();
    } catch (err) {
      this.log({ task, attempt: 1, durationMs: 0, outcome: "unavailable" });
      throw new ReasonerError("unavailable", task, (err as Error).message);
    }

    let prompt = input.prompt;
    let lastIssues: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      const res = await this.run(this.request(args, prompt, timeoutMs, cwd));
      const durationMs = Date.now() - started;
      const fail = (outcome: ReasonerLogEntry["outcome"], err: ReasonerError): never => {
        this.log({ task, attempt, durationMs, outcome });
        throw err;
      };

      if (res.spawnError) {
        const missing = res.spawnError.code === "ENOENT";
        fail("unavailable", new ReasonerError("unavailable", task, missing ? "claude executable not found on PATH" : `could not start claude: ${res.spawnError.message}`, { code: res.spawnError.code }));
      }
      if (res.timedOut) {
        fail("timeout", new ReasonerError("timeout", task, `claude did not finish within ${timeoutMs} ms`, { timeoutMs }));
      }

      const envelope = readClaudeEnvelope(res.stdout);
      if (envelope.kind === "provider_error") {
        fail("unavailable", new ReasonerError("unavailable", task, `claude reported an error: ${snippet(envelope.message)}`, { exitCode: res.exitCode, stderr: snippet(res.stderr) }));
      }
      if (envelope.kind !== "schema_rejected" && res.exitCode !== 0) {
        fail("unavailable", new ReasonerError("unavailable", task, `claude exited with code ${res.exitCode ?? res.signal}`, { exitCode: res.exitCode, signal: res.signal, stderr: snippet(res.stderr) }));
      }

      if (envelope.kind === "ok") {
        const validated = validateStructured(schema, envelope.payload);
        if (validated.ok) {
          this.log({ task, attempt, durationMs, outcome: "ok" });
          return validated.value;
        }
        lastIssues = validated.issues;
      } else if (envelope.kind === "schema_rejected" || envelope.kind === "malformed") {
        lastIssues = envelope.issues;
      }

      this.log({ task, attempt, durationMs, outcome: "invalid_output" });
      prompt = buildRetryPrompt(input.prompt, lastIssues);
    }

    throw new ReasonerError("invalid_output", task, "structured output failed validation after one retry", { issues: boundIssues(lastIssues) });
  }
}
