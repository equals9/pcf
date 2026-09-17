# PCF Build Status

## Current phase
Phase 1 — Domain + persistence: COMPLETE, awaiting human review before Phase 2. Uncommitted by instruction.
Phase 0 approved and checkpointed at commit `9b147e1`, tag `pcf-v0.1-phase-0`.

## Phase 1 requirements (SPEC.md §41)
domain types, Zod schemas, migration (`001_initial.sql`), repositories, event writes, seed script. No AI.

## Phase 1 delivered
- `lib/domain/types.ts` — SPEC §9 types verbatim, plus `EventType` (§11) and row types `CognitiveEvent`, `OperatorRun`, `FeedbackRecord` for tables §10 defines but §9 does not name
- `lib/domain/houses.ts` — §12 ontology table, `HOUSE_NUMBERS`, `houseVector()` helper
- `lib/domain/relations.ts`, `lib/domain/operators.ts` — frozen enum constants
- `lib/domain/schemas.ts` — Zod schemas for every persisted shape; house vector = exactly 12 keys, each in [0,1]; relation self-link refine
- `lib/utils/ids.ts`, `time.ts`, `text.ts`
- `lib/db/migrations/001_initial.sql` — SPEC §10 verbatim (markdown escapes removed, no semantic change)
- `lib/db/repositories/{objects,concepts,relations,claims,events,operators,feedback}.ts` — plain functions over `PcfDatabase`; every write validates through Zod first
- `scripts/seed-demo.ts` + `npm run seed` — 15 synthetic objects, 28 concepts, 4 claims, 8 relations, 56 events; idempotent; deterministic for a fixed `now`
- Tests: `tests/unit/domain.test.ts` (9), `tests/integration/persistence.test.ts` (11), `tests/integration/seed.test.ts` (2), plus Phase 0's 3 + 2 e2e

## Phase 1 acceptance gates (2026-09-16)
| Gate | Result |
|------|--------|
| `npm test` | PASS — 4 files, 27 tests |
| `npm run build` | PASS — Next.js 16.3.5 |
| `npm run migrate` on `./data/pcf.db` | PASS — `001_initial.sql` applied; rerun skips |
| `npm run seed` | PASS — 15 objects / 180 house rows / 28 concepts / 8 relations / 4 claims / 56 events; rerun writes nothing |
| Tables present | objects, house_scores, concepts, object_concepts, relations, claims, events, operator_runs, feedback, schema_migrations |
| SPEC §34 static check | PASS — no `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY` |
| `SPEC.md` / `CLAUDE.md` | byte-identical to tag `pcf-v0.1-phase-0` |

## Phase 1 dependencies added
- `zod` ^4.6.5 (runtime) — required by SPEC §6/§41 for domain validation. Nothing else.

## Phase 1 interpretation decisions (non-blocking)
- `claims.created_at` exists in §10 but not in the `Claim` type (§9): `insertClaim` takes `createdAt` as a separate argument; the returned/domain `Claim` stays exactly the §9 shape.
- `OperatorRun`, `CognitiveEvent`, `FeedbackRecord` types added to `types.ts` because §10 defines the tables but §9 defines no row type; JSON columns are parsed to `Record<string, unknown>`.
- `Relation.origin` reuses `ProvenanceOrigin` (identical literal union in §9).
- Events are append-only: repository exposes `appendEvent` and `listEvents` only; no update/delete. `ON DELETE SET NULL` behaviour verified so history survives object deletion.
- Concepts are keyed by `normalizeConceptName` (trim, lowercase, collapse whitespace); first display name seen is kept.
- `updateObject` never touches `content` (raw text canonical, §14).
- Seed timestamps are offsets from an injectable `now` so "old unresolved question" (120 days) and resurfacing ages stay meaningful; IDs, content, houses, concepts, relations are fixed. Seed house vectors are hand-authored (no AI in Phase 1). The seed contradiction pair mirrors the §32 contradiction fixture.
- Library code uses relative imports (not the `@/` alias) so `tsx` scripts and Vitest need no alias config; app code keeps `@/`.
- Zod's `z.enum` for relation/operator constants is typed via the readonly arrays in `relations.ts`/`operators.ts`, so schemas and types share one source.
- `npm install zod` triggered the npm optional-dependency bug (Vitest's rolldown binding vanished); fixed by a clean reinstall. `package-lock.json` regenerated.

## Deviations from SPEC.md
- none.

## Blockers
- none

## Next action
Human review of Phase 1. On approval: Phase 2 — Claude subscription adapter (Reasoner interface, ClaudeSubscriptionReasoner via `claude` CLI, MockReasoner, preflight, structured-output validator).

## Phase 0 requirements (SPEC.md §41)
- Next.js app — `app/layout.tsx`, `app/page.tsx`, `next.config.ts`
- TypeScript — `tsconfig.json` (strict)
- SQLite connection — `lib/db/database.ts` (better-sqlite3, default `./data/pcf.db`, WAL, foreign keys ON)
- migration runner — `lib/db/migrations.ts` + `scripts/migrate.ts` (ordered `.sql`, tracked in `schema_migrations`, idempotent, transactional)
- Vitest — `vitest.config.mts`, `tests/unit/migrations.test.ts`
- Playwright — `playwright.config.ts`, `tests/acceptance/today.spec.ts` (A1, A2)
- basic Today shell — `components/today/{TodayView,DateHeader,CaptureBox}.tsx`, `components/constellation/ConstellationPane.tsx`, `app/globals.css`

## Phase 0 acceptance gates (2026-09-16)
| Gate | Result |
|------|--------|
| `npm test` | PASS — 1 file, 3 tests (Vitest 5.0.1) |
| `npm run build` | PASS — Next.js 16.3.5, routes `/` and `/_not-found` static |
| `npm run test:e2e` (extra) | PASS — 2 tests (A1, A2) on port 3210 |
| `npm run migrate` (extra) | PASS — creates `data/pcf.db`; no migrations yet (001_initial.sql is Phase 1) |
| Static SDK/API-key check (SPEC §34) | PASS — no `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY` references |

## Dependencies added
Runtime: `next`, `react`, `react-dom`, `better-sqlite3`.
Dev: `typescript` (5.x), `@types/node`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`, `vitest`, `@playwright/test`, `tsx` (runs `scripts/*.ts`).
Not added yet (later phases): `zod` (Phase 1), `@anthropic-ai/sdk` (never).

## Simpler-interpretation decisions (non-blocking ambiguities)
- Styling: plain `app/globals.css` with class names (no Tailwind, no CSS modules) — least scaffold code (SPEC §6).
- `lib/db/migrations/` is intentionally empty in Phase 0; the runner is tested against `tests/fixtures/migrations/`. The frozen `001_initial.sql` is delivered in Phase 1 ("migration").
- `openDatabase(path?)` accepts a path (env `PCF_DB_PATH` or argument) so tests use `:memory:`; default remains `./data/pcf.db`.
- Today shell is static: capture textarea renders but does not submit (capture pipeline is Phase 3). The constellation pane renders the empty astrolabe scaffold only (SPEC §25G).
- `npm test` runs Vitest only; Playwright runs via `npm run test:e2e` on port 3210 with `reuseExistingServer: false` so it can never attach to an unrelated dev server on 3000.
- Next 16's `next dev` auto-appends an "agent rules" block to `CLAUDE.md` when it detects an AI agent. `AGENTS.md` was added so that block lands there and `CLAUDE.md` stays byte-identical to the frozen handoff.
- Next's build rewrote `tsconfig.json` (`jsx: react-jsx`, extra `.next/dev/types` include); kept as-is.

## Deviations from SPEC.md
- none. `SPEC.md` unchanged. `AGENTS.md` is a tooling file, not a product surface.

## Blockers
- none

## Next action
Human review of Phase 0. On approval: Phase 1 — Domain + persistence (domain types, Zod schemas, `001_initial.sql`, repositories, event writes, seed script).

## Phase log
| Phase | Status | Gate result |
|-------|--------|-------------|
| 0 — Scaffold | approved, tag `pcf-v0.1-phase-0` | npm test PASS, npm run build PASS |
| 1 — Domain + persistence | complete (pending review) | npm test PASS (27), npm run build PASS |
| 2 — Claude subscription adapter | not started | — |
| 3 — Capture intelligence | not started | — |
| 4 — Relevance + constellation | not started | — |
| 5 — Four operators | not started | — |
| 6 — Cognitive return | not started | — |
| 7 — Product polish | not started | — |
