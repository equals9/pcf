// Run with: node --import tsx tests/fixtures/reasoner-cwd-probe.mjs
// PROBE_UID: "none" removes process.getuid (Windows-like); a number stubs it; unset keeps the real uid.
// PROBE_ACTION: "cwd" (default) prints two defaultReasonerCwd() results; "fail" reports runStructured/healthCheck errors.
// PROBE_TMPDIR: applied after modules load (tsx itself needs a working temp dir to start).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
if (process.env.PROBE_UID === "none") process.getuid = undefined;
else if (process.env.PROBE_UID) process.getuid = () => Number(process.env.PROBE_UID);

const load = async (rel) => {
  const mod = await import(join(here, "..", "..", rel));
  return mod.default && !Object.keys(mod).some((k) => k !== "default" && k !== "module.exports") ? mod.default : mod;
};
const adapter = await load("lib/ai/claude-subscription.ts");
const { ReasonerError } = await load("lib/ai/reasoner.ts");
const { z } = await import("zod");
if (process.env.PROBE_TMPDIR) process.env.TMPDIR = process.env.PROBE_TMPDIR;

if ((process.env.PROBE_ACTION ?? "cwd") === "cwd") {
  console.log(JSON.stringify({ first: adapter.defaultReasonerCwd(), second: adapter.defaultReasonerCwd() }));
} else {
  const logs = [];
  const reasoner = new adapter.ClaudeSubscriptionReasoner({ run: async () => { throw new Error("run must not be called"); }, log: (e) => logs.push(e) });
  const err = await reasoner.runStructured({ task: "probe", system: "s", prompt: "p", schema: z.object({ ok: z.boolean() }) }).catch((e) => e);
  const health = await reasoner.healthCheck();
  console.log(JSON.stringify({ isReasonerError: err instanceof ReasonerError, name: err.name, kind: err.kind, message: err.message, logs, health }));
}
