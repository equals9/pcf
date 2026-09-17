import { z } from "zod";

// SPEC.md §16 item 11 — every structured LLM output is validated before use.

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

/** JSON Schema describing what the model must produce (the schema's input side). */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`);
}

export function validateStructured<T>(schema: z.ZodType<T>, value: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(value);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, issues: formatIssues(parsed.error) };
}

/** Parse JSON text, tolerating a surrounding markdown code fence. Returns undefined if not JSON. */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  try {
    return JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    return undefined;
  }
}

export type EnvelopeResult =
  | { kind: "ok"; payload: unknown }
  | { kind: "provider_error"; message: string }
  /** Claude Code's own --json-schema check rejected the model output (subtype error_max_structured_output_retries). */
  | { kind: "schema_rejected"; issues: string[] }
  | { kind: "malformed"; issues: string[] };

function envelopeErrors(e: Record<string, unknown>): string[] {
  return Array.isArray(e.errors) ? e.errors.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

/**
 * Interpret `claude -p --output-format json` stdout.
 * `is_error: true` is authoritative (the CLI reports `subtype: "success"` even for API errors).
 * `subtype: "error_max_structured_output_retries"` means the output failed the CLI's JSON-schema check;
 * that is an output-validation failure, not an unavailable provider.
 * The payload is `structured_output` when present, otherwise the `result` text parsed as JSON.
 */
export function readClaudeEnvelope(stdout: string): EnvelopeResult {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    return { kind: "malformed", issues: ["(root): CLI output was not valid JSON"] };
  }
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
    return { kind: "malformed", issues: ["(root): CLI output was not a JSON object"] };
  }
  const e = envelope as Record<string, unknown>;
  if (e.is_error === true) {
    const errors = envelopeErrors(e);
    if (e.subtype === "error_max_structured_output_retries") {
      return { kind: "schema_rejected", issues: errors.length ? errors : ["(root): output failed the JSON schema"] };
    }
    const message = typeof e.result === "string" && e.result.length > 0 ? e.result : errors.length ? errors.join("; ") : "provider reported an error";
    return { kind: "provider_error", message };
  }
  if (e.structured_output !== undefined && e.structured_output !== null) {
    return { kind: "ok", payload: e.structured_output };
  }
  if (typeof e.result === "string") {
    const parsed = parseJsonText(e.result);
    if (parsed !== undefined) return { kind: "ok", payload: parsed };
  }
  return { kind: "malformed", issues: ["(root): response contained no structured output"] };
}
