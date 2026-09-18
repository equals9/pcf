import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PcfDatabase } from "../../lib/db/database";
import { attachConcept, upsertConcept } from "../../lib/db/repositories/concepts";
import { insertObject, setHouseScores } from "../../lib/db/repositories/objects";
import { houseVector } from "../../lib/domain/houses";
import { MAX_CONSTELLATION_NODES } from "../../lib/engine/constellation";
import { newTestDb } from "../fixtures/capture-fixtures";

// SPEC §26 GET /api/object/:id/constellation, through the real route module.

const app = vi.hoisted(() => ({ db: null as PcfDatabase | null }));

vi.mock("../../lib/db/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db/database")>();
  return {
    ...actual,
    getAppDatabase: () => {
      if (!app.db) throw new Error("test: database unavailable");
      return app.db;
    },
  };
});

const { GET } = await import("../../app/api/object/[id]/constellation/route");

const AT = "2026-09-17T12:00:00.000Z";

function add(db: PcfDatabase, id: string, concepts: string[], at = AT) {
  insertObject(db, {
    id,
    type: "thought",
    content: `content of ${id}`,
    title: `title of ${id}`,
    createdAt: at,
    updatedAt: at,
    lastActivatedAt: null,
    importance: 0.5,
    activation: 0.5,
    status: "active",
    provenance: "user",
  });
  for (const name of concepts) attachConcept(db, id, upsertConcept(db, name, at).id);
  const v = houseVector(0.05);
  v[2] = 0.9;
  setHouseScores(db, id, v);
}

function request(id: string, init: { host?: string | null; origin?: string } = {}): [Request, { params: Promise<{ id: string }> }] {
  const headers = new Headers();
  if (init.host !== null) headers.set("host", init.host ?? "localhost:3000");
  if (init.origin !== undefined) headers.set("origin", init.origin);
  return [new Request(`http://localhost/api/object/${id}/constellation`, { headers }), { params: Promise.resolve({ id }) }];
}

const call = (id: string, init?: { host?: string | null; origin?: string }) => GET(...(request(id, init) as Parameters<typeof GET>));

let errors: unknown[][];

beforeEach(() => {
  app.db = newTestDb();
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
});

afterEach(() => {
  vi.mocked(console.error).mockRestore();
  app.db?.close();
  app.db = null;
});

const db = () => app.db as PcfDatabase;

describe("GET /api/object/:id/constellation", () => {
  it("returns the anchor, its nodes and its edges", async () => {
    add(db(), "anchor", ["alpha"]);
    add(db(), "other", ["alpha"]);
    const res = await call("anchor");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["anchor", "edges", "nodes"]);
    expect(body.anchor.id).toBe("anchor");
    expect(body.nodes).toHaveLength(1);
    expect(body.nodes[0]).toMatchObject({
      object: expect.objectContaining({ id: "other" }),
      relevance: expect.any(Number),
      dominantHouse: 2,
      x: expect.any(Number),
      y: expect.any(Number),
      radius: expect.any(Number),
    });
    expect(body.edges).toEqual([]);
  });

  it("never returns more than 12 nodes", async () => {
    add(db(), "anchor", ["alpha"]);
    for (let i = 0; i < 20; i++) add(db(), `c-${i}`, ["alpha", `t-${i}`]);
    const body = await (await call("anchor")).json();
    expect(body.nodes).toHaveLength(MAX_CONSTELLATION_NODES);
  });

  it("answers 404 for an unknown object", async () => {
    const res = await call("missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("refuses requests addressed to another host, or from another origin", async () => {
    add(db(), "anchor", ["alpha"]);
    for (const init of [{ host: "rebind.attacker.example:3000" }, { host: null }, { origin: "http://attacker.example" }]) {
      const res = await call("anchor", init);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "forbidden" });
    }
  });

  it("reports a database failure without leaking content", async () => {
    add(db(), "anchor", ["alpha"]);
    db().exec("DROP TABLE house_scores");
    const res = await call("anchor");
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "constellation_failed" });
    const logged = errors.flat().map(String).join("\n");
    expect(logged).toContain('"outcome":"failed"');
    expect(logged).not.toContain("content of anchor");
  });

  it("is an adapter: it imports only the app database, the engine and the loopback check", () => {
    const source = readFileSync(join(__dirname, "../../app/api/object/[id]/constellation/route.ts"), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports).toEqual([
      "../../../../../lib/db/database",
      "../../../../../lib/engine/constellation",
      "../../../../../lib/utils/local-request",
    ]);
    expect(source.match(/buildConstellation\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/Math\.|insert|update |delete /i);
  });
});
