# PCF Build Status

## Current phase
Phase 0 — Scaffold: COMPLETE, awaiting human review before Phase 1.

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
| 0 — Scaffold | complete (pending review) | npm test PASS, npm run build PASS |
| 1 — Domain + persistence | not started | — |
| 2 — Claude subscription adapter | not started | — |
| 3 — Capture intelligence | not started | — |
| 4 — Relevance + constellation | not started | — |
| 5 — Four operators | not started | — |
| 6 — Cognitive return | not started | — |
| 7 — Product polish | not started | — |
