#!/usr/bin/env node
// Fake `claude` CLI for adapter tests. Never contacts any service.
// Behaviour is selected by FAKE_CLAUDE_MODE; per-invocation state lives in FAKE_CLAUDE_STATE_DIR.
import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const mode = process.env.FAKE_CLAUDE_MODE ?? "ok";
const stateDir = process.env.FAKE_CLAUDE_STATE_DIR;
const args = process.argv.slice(2);

// First thing: become killable only by SIGKILL (where requested) and record the pid, so tests can always clean up.
if (mode === "hang_ignore_term" || mode === "orphan_holds_stdout") process.on("SIGTERM", () => {});
if (stateDir && args[0] !== "--version") writeFileSync(join(stateDir, "pid"), String(process.pid));

const spawnOrphan = () => {
  // A grandchild inherits stdout/stderr and outlives this process, so the pipes never close.
  const orphan = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "inherit", "inherit"], detached: true });
  if (stateDir) writeFileSync(join(stateDir, "orphan-pid"), String(orphan.pid));
  orphan.unref();
};

if (args[0] === "--version") {
  if (mode === "version_fail") {
    process.stderr.write("fake version failure\n");
    process.exit(3);
  }
  process.stdout.write("9.9.9 (Fake Claude Code)\n");
  process.exit(0);
}

const stdin = readFileSync(0, "utf8");

let call = 1;
if (stateDir) {
  const counter = join(stateDir, "count");
  call = existsSync(counter) ? Number(readFileSync(counter, "utf8")) + 1 : 1;
  writeFileSync(counter, String(call));
  appendFileSync(
    join(stateDir, "calls.jsonl"),
    JSON.stringify({
      call,
      args,
      stdin,
      cwd: process.cwd(),
      hasApiKey: Object.prototype.hasOwnProperty.call(process.env, "ANTHROPIC_API_KEY"),
      maxStructuredOutputRetries: process.env.MAX_STRUCTURED_OUTPUT_RETRIES ?? null,
      keepMe: process.env.FAKE_CLAUDE_KEEP_ME ?? null,
      start: Date.now(),
    }) + "\n",
  );
}

const envelope = (fields) => JSON.stringify({ type: "result", subtype: "success", is_error: false, ...fields });
// Shape emitted by Claude Code when output fails --json-schema MAX_STRUCTURED_OUTPUT_RETRIES times (no `result` field).
const schemaExhausted = JSON.stringify({
  type: "result",
  subtype: "error_max_structured_output_retries",
  is_error: true,
  terminal_reason: "structured_output_retry_exhausted",
  errors: ["Failed to provide valid structured output after 1 attempts — last StructuredOutput error: label: expected string"],
});
const good = { ok: true, label: "fake" };

const done = (out, code = 0) => {
  if (stateDir) appendFileSync(join(stateDir, "ends.jsonl"), JSON.stringify({ call, end: Date.now() }) + "\n");
  process.stdout.write(out);
  process.stderr.write("fake stderr line\n");
  process.exit(code);
};

switch (mode) {
  case "ok":
    done(envelope({ result: JSON.stringify(good), structured_output: good }));
    break;
  case "slow_ok":
    setTimeout(() => done(envelope({ result: JSON.stringify(good), structured_output: good })), 150);
    break;
  case "result_text_only":
    done(envelope({ result: "```json\n" + JSON.stringify(good) + "\n```" }));
    break;
  case "invalid_then_ok":
    done(call === 1 ? envelope({ result: "{}", structured_output: { ok: "yes" } }) : envelope({ result: JSON.stringify(good), structured_output: good }));
    break;
  case "always_invalid":
    done(envelope({ result: "{}", structured_output: { ok: "yes" } }));
    break;
  case "schema_exhausted_then_ok":
    if (call === 1) done(schemaExhausted, 1);
    else done(envelope({ result: JSON.stringify(good), structured_output: good }));
    break;
  case "schema_exhausted":
    done(schemaExhausted, 1);
    break;
  case "not_json":
    done("this is not json");
    break;
  case "provider_error":
    done(envelope({ is_error: true, result: "There's an issue with the selected model." }), 1);
    break;
  case "exit_nonzero":
    done("", 2);
    break;
  case "hang":
    setInterval(() => {}, 1000);
    break;
  case "hang_ignore_term":
    setInterval(() => {}, 1000);
    break;
  case "orphan_holds_stdout":
    spawnOrphan();
    setInterval(() => {}, 1000);
    break;
  case "exit_with_orphan":
    spawnOrphan();
    done(envelope({ result: JSON.stringify(good), structured_output: good }));
    break;
  default:
    process.stderr.write(`unknown FAKE_CLAUDE_MODE ${mode}\n`);
    process.exit(99);
}
