import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// SPEC.md §34 — static subscription-boundary check.
const ROOT = join(__dirname, "..", "..");
const SOURCE_DIRS = ["app", "components", "lib", "scripts"];
const ROOT_FILES = ["next.config.ts", "playwright.config.ts", "vitest.config.mts", ".env.example"];
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ADAPTER = "lib/ai/claude-subscription.ts";
const API_KEY = ["ANTHROPIC", "API", "KEY"].join("_");
const SDK = ["@anthropic-ai", "sdk"].join("/");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : SOURCE_EXT.test(name) ? [full] : [];
  });
}

const files = [...SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d))), ...ROOT_FILES.map((f) => join(ROOT, f))];
const read = (f: string) => ({ path: relative(ROOT, f), text: readFileSync(f, "utf8") });

describe("Claude subscription boundary (SPEC §34)", () => {
  it("does not depend on the Anthropic API SDK", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies };
    expect(Object.keys(deps)).not.toContain(SDK);
    const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
    expect(Object.keys(lock.packages ?? {}).filter((p) => p.includes(SDK))).toEqual([]);
  });

  it("never imports the SDK or calls Anthropic HTTP APIs from application source", () => {
    for (const { path, text } of files.map(read)) {
      expect(text.includes(SDK), `${path} references the Anthropic SDK`).toBe(false);
      expect(/api\.anthropic\.com/i.test(text), `${path} references the Anthropic HTTP API`).toBe(false);
    }
  });

  it("references the API key only in the adapter's environment-removal list", () => {
    const offenders = files.map(read).filter(({ path, text }) => path !== ADAPTER && text.includes(API_KEY));
    expect(offenders.map((o) => o.path)).toEqual([]);

    const adapterLines = readFileSync(join(ROOT, ADAPTER), "utf8").split("\n").filter((l) => l.includes(API_KEY));
    expect(adapterLines).toEqual([`export const STRIPPED_ENV_VARS = ["${API_KEY}"] as const;`]);
  });

  it("does not offer an API-key setup flow", () => {
    for (const { path, text } of files.map(read)) {
      expect(/x-api-key|apiKeyHelper/i.test(text), `${path} mentions API-key auth`).toBe(false);
    }
  });
});
