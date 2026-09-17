import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonText, readClaudeEnvelope, toJsonSchema, validateStructured } from "../../lib/ai/structured-output";

const schema = z.object({ ok: z.boolean(), label: z.string().max(5) });

describe("toJsonSchema", () => {
  it("produces a plain JSON Schema object without $schema", () => {
    const json = toJsonSchema(schema);
    expect(json.$schema).toBeUndefined();
    expect(json.type).toBe("object");
    expect(json.required).toEqual(["ok", "label"]);
  });

  it("describes the input side of transforming schemas instead of throwing", () => {
    const transformed = z.object({ n: z.number() }).transform((v) => v.n * 2);
    expect(toJsonSchema(transformed).type).toBe("object");
  });
});

describe("validateStructured", () => {
  it("returns the parsed value when valid", () => {
    expect(validateStructured(schema, { ok: true, label: "hi" })).toEqual({ ok: true, value: { ok: true, label: "hi" } });
  });

  it("returns readable issues with paths when invalid", () => {
    const res = validateStructured(schema, { ok: "yes", label: "toolong" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.some((i) => i.startsWith("ok:"))).toBe(true);
      expect(res.issues.some((i) => i.startsWith("label:"))).toBe(true);
    }
  });
});

describe("parseJsonText", () => {
  it("parses bare and fenced JSON and rejects prose", () => {
    expect(parseJsonText('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonText('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonText("sure, here you go")).toBeUndefined();
  });
});

describe("readClaudeEnvelope", () => {
  const env = (fields: Record<string, unknown>) => JSON.stringify({ type: "result", subtype: "success", is_error: false, ...fields });

  it("prefers structured_output over parseable result text", () => {
    expect(readClaudeEnvelope(env({ result: '{"ok":false}', structured_output: { ok: true } }))).toEqual({ kind: "ok", payload: { ok: true } });
  });

  it("falls back to JSON in result text", () => {
    expect(readClaudeEnvelope(env({ result: '{"ok":true}' }))).toEqual({ kind: "ok", payload: { ok: true } });
  });

  it("treats is_error as a provider error even when subtype says success", () => {
    expect(readClaudeEnvelope(env({ is_error: true, result: "model issue" }))).toEqual({ kind: "provider_error", message: "model issue" });
  });

  it("maps the CLI's structured-output retry exhaustion to schema_rejected with its errors", () => {
    const exhausted = JSON.stringify({
      type: "result",
      subtype: "error_max_structured_output_retries",
      is_error: true,
      errors: ["Failed to provide valid structured output after 1 attempts — last StructuredOutput error: x"],
    });
    expect(readClaudeEnvelope(exhausted)).toEqual({
      kind: "schema_rejected",
      issues: ["Failed to provide valid structured output after 1 attempts — last StructuredOutput error: x"],
    });
    expect(readClaudeEnvelope(JSON.stringify({ type: "result", subtype: "error_max_structured_output_retries", is_error: true }))).toEqual({
      kind: "schema_rejected",
      issues: ["(root): output failed the JSON schema"],
    });
  });

  it("uses the errors array for other CLI error subtypes without a result", () => {
    const envl = JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, errors: ["first", "second"] });
    expect(readClaudeEnvelope(envl)).toEqual({ kind: "provider_error", message: "first; second" });
    expect(readClaudeEnvelope(JSON.stringify({ type: "result", is_error: true }))).toEqual({ kind: "provider_error", message: "provider reported an error" });
  });

  it("reports malformed output", () => {
    expect(readClaudeEnvelope("not json").kind).toBe("malformed");
    expect(readClaudeEnvelope("[1,2]").kind).toBe("malformed");
    expect(readClaudeEnvelope(env({ result: "plain prose" })).kind).toBe("malformed");
  });
});
