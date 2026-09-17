# PCF Build Status

## Current phase
Phase 2 — Claude subscription adapter: APPROVED 2026-09-16, checkpointed at tag `pcf-v0.1-phase-2`.
Phase 3 has not started and requires explicit authorization.
Phase 1 approved and checkpointed at commit `cf81676`, tag `pcf-v0.1-phase-1`.

## Phase 2 requirements (SPEC.md §16, §29, §30, §34, §41)
Reasoner interface, ClaudeSubscriptionReasoner, MockReasoner, preflight script, structured-output validator. No Anthropic SDK, no API key. Acceptance: mock tests green; manual preflight documented.

## Phase 2 CLI inspection (Claude Code 2.1.273)
Sources: `claude --help`, and the official docs pages cli-reference, headless and env-vars (fetched 2026-09-16).
- Flags used, all documented: `-p`, `--output-format json`, `--json-schema`, `--system-prompt` (replaces the default prompt), `--tools ""` (no built-in tools), `--no-session-persistence` (print only), `--strict-mcp-config` (no MCP servers without `--mcp-config`), `--disable-slash-commands`, `--safe-mode` (no CLAUDE.md, hooks, plugins, MCP, auto memory; auth and model selection unchanged), `--version`.
- Prompt goes on stdin; the headless docs say print mode reads stdin (10 MB cap).
- Env var set for the child, documented in env-vars: `MAX_STRUCTURED_OUTPUT_RETRIES` is the number of structured-output attempts Claude Code itself makes within one `-p` invocation when output fails `--json-schema` (default 5: a first attempt plus four retries). PCF sets it to `1`, so each CLI invocation makes at most one model attempt and never retries internally.
- Rejected: `--bare` (documented to skip OAuth/keychain), `--model` (SPEC §16 default-model rule).
- Live probes in a clean environment: a success envelope has `is_error:false` and `structured_output`, and the configured default model answered under `--safe-mode`. A failing call exits 1 with `is_error:true` while `subtype` still reads `"success"`. The CLI's schema-exhaustion envelope (`subtype:"error_max_structured_output_retries"`, `errors[]`, no `result`) was confirmed from the CLI's own result schema in the binary.

## Phase 2 delivered
- `lib/ai/reasoner.ts`: the §16 `Reasoner` interface, plus `ReasonerHealth` and `ReasonerError` with `kind` = `unavailable` | `timeout` | `invalid_output`. `system` is documented as fixed instruction text that must never contain user content; user content goes in `prompt`.
- `lib/ai/structured-output.ts`: Zod to JSON Schema (input side), validation with readable issues, and envelope parsing (`ok`, `provider_error`, `schema_rejected`, `malformed`).
- `lib/ai/claude-subscription.ts`: `ClaudeSubscriptionReasoner`. It:
  - spawns `claude` without a shell and sends the prompt on stdin;
  - removes `ANTHROPIC_API_KEY` and sets `MAX_STRUCTURED_OUTPUT_RETRIES=1` (one model attempt per CLI invocation);
  - captures stdout and stderr separately;
  - enforces a timeout and a 10 MB output cap;
  - invokes Claude at most once more after invalid output, passing bounded validation errors;
  - runs one model call at a time per process;
  - uses a verified private working directory.
- `tests/fixtures/mock-reasoner.ts`: the deterministic §30 mock.
- `tests/fixtures/fake-claude.mjs`: a fake CLI so process-level tests never use the subscription.
- `tests/fixtures/reasoner-cwd-probe.mjs`: a subprocess probe for working-directory selection with a stubbed uid or temp dir.
- `scripts/preflight.ts` plus `npm run preflight`: the five §16 checks. It never reads credentials.
- Tests:
  - `tests/unit/structured-output.test.ts`
  - `tests/unit/claude-subscription.test.ts`
  - `tests/unit/mock-reasoner.test.ts`
  - `tests/unit/subscription-boundary.test.ts` (the §34 static check)
  - `tests/integration/claude-subscription-process.test.ts`
  - `tests/integration/preflight.test.ts`
- `README.md`: prerequisites (Node range) and manual preflight documentation. `.env.example` reworded so it no longer contains the API-key variable name.
- `package.json`: `preflight` script, and an `engines` field (`^22.12.0 || ^24.0.0 || >=26.0.0`) matching the strictest dependency ranges (vitest 5 and better-sqlite3 13).

## Phase 2 acceptance gates (2026-09-16, final code)
| Gate | Result |
|------|--------|
| `npm test` | PASS: 10 files, 87 tests, no Claude usage |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS: Next.js 16.3.5 |
| `npm run test:e2e` | PASS: A1 and A2 |
| `npm run preflight` (manual, real subscription, clean env) | PASS 5/5, exit code 0 |
| SPEC §34 static check | PASS, enforced by `tests/unit/subscription-boundary.test.ts` |
| Mutation check of the adapter tests | all 28 injected regressions fail the suite |
| Attempt limit for invalid output (mocked) | PASS: exactly 2 CLI invocations, each with `MAX_STRUCTURED_OUTPUT_RETRIES=1`; removing the cap from the retry invocation, or allowing a third invocation, fails the suite |
| `SPEC.md` / `CLAUDE.md` | unchanged since tag `pcf-v0.1-phase-1` |

## Phase 2 dependencies added
- none. `package.json` changed only by the `preflight` script and the `engines` field.

## Phase 2 interpretation decisions (non-blocking)
- **Health check.** `ReasonerHealth` is not defined in SPEC; it is defined as `{ available, provider, version, error }`. `healthCheck()` runs only `claude --version`, so it never uses the subscription. Preflight performs the real invocation.
- **Model.** `PCF_CLAUDE_MODEL` is not read. SPEC §16 says it "may override this later". No `--model` flag is passed.
- **Attempt limit.** SPEC §16 allows one retry of malformed structured output. PCF owns that retry, outside the CLI:
  - `MAX_STRUCTURED_OUTPUT_RETRIES=1` lets Claude Code make one structured-output attempt per CLI invocation. It is an attempt cap, not a retry.
  - The first PCF invocation makes at most one model attempt.
  - If that result is classified `invalid_output`, PCF may invoke Claude once more, passing the validation errors.
  - The second PCF invocation also makes at most one model attempt.
  - The total is at most two model attempts: the initial attempt plus one PCF-controlled retry.
  - Invalid output includes the CLI's own give-up envelope (`error_max_structured_output_retries`), even with a non-zero exit, and Zod-only failures such as refinements JSON Schema cannot express.
- **Error kinds.**
  - `is_error:true` is `unavailable` and is never retried. The provider's `result` text is kept, or `errors[]` when there is no result.
  - A non-zero exit without a schema-rejection envelope is `unavailable`.
  - A failure to prepare the working directory is `unavailable`.
  - Timeouts are `timeout`, are not retried, and each attempt gets the full timeout.
- **Timeout mechanics.**
  - At the deadline: SIGTERM, then SIGKILL after 2 s.
  - Once the child has exited, the call settles within a further 2 s even if another process holds its output pipes.
  - A deadline that passes after the child already exited is not reported as a timeout.
- **Concurrency.** Concurrency 1 is a module-level queue covering `runStructured` only. `healthCheck` is not queued.
- **Working directory.** Print mode skips Claude Code's workspace trust prompt, and the CLI docs say to use it only in trusted directories. So the child never runs in the shared temp dir or the repo:
  - It uses `<tmpdir>/pcf-reasoner-<uid>` when that is a real directory (not a symlink), owned by the user, with no group or other permissions.
  - Otherwise it uses a fresh `mkdtemp` directory, reused for the rest of the process.
  - On platforms without POSIX uids, the per-user temp dir is trusted and mode bits are ignored.
  - A cached directory is only re-checked for existence, because other users cannot change its owner or mode.
- **Logging (§29).** An optional `log` callback receives the task, attempt, duration and outcome only. Nothing is logged by default.
- **Bounded error text.**
  - stderr and provider messages in errors are cut to 500 characters.
  - Validation issues, in both `details.issues` and the retry prompt, are limited to 20 items of at most 500 characters each.
- **System prompt.** PCF uses `--system-prompt` because the system instruction is already available as an in-memory string for each invocation; no temporary prompt file is necessary. (`--system-prompt-file` is a documented, supported flag; the CLI reference notes that `claude --help` does not list every flag.) System prompts are fixed instruction text; user content travels only on stdin. The JSON schema also travels in argv.
- **Subscription usage.** Four calls in total:
  - two probes: one tiny successful call, and one request rejected for an invalid model name;
  - two real preflight runs: one before the final working-directory change and one on the final code.

## Phase 2 review
- **First review.** Six lenses (spec, process handling, security, test strength, CLI flags, fitness for later phases) produced 17 findings. After three skeptics per finding, 8 survived, and all are fixed:
  1. Tests now assert the exact argv the reasoner passes.
  2. API-key stripping is tested on the default `process.env` path.
  3. Tests check the child is actually killed, and exercise SIGKILL escalation and the forced settle.
  4. `is_error` with exit code 0 is tested on its own.
  5. structured_output-over-result precedence is tested with parseable result text.
  6. and 7. The CLI's schema-retry exhaustion was reported as `unavailable`; it is now `invalid_output` via the adapter retry.
  8. The CLI's default of 5 structured-output attempts per invocation, combined with the PCF retry, allowed up to 10 model attempts and broke the §16 one-retry rule. Each invocation is now capped at one attempt.
- **Also fixed from the rejected set:** the working directory moved off the shared temp dir, and the timeout now settles even if another process holds the output pipes.
- **Second review.** Covered the post-review code and this write-up: 11 findings, 9 survived, all fixed.
  - A clean exit while another process held the pipes was reported as a timeout.
  - A working-directory failure escaped as a plain `Error`.
  - A new temp dir was created on every call on platforms without uids.
  - Kill tests could leave fake processes running.
  - The build and preflight results predated the final working-directory change. Both were re-run on the final code.
  - The ownership check is now tested with a stubbed uid; the earlier "needs root" note was wrong.
  - Bounds on error text now also cover validation issues.
  - The system-prompt claim was corrected.
  - The README Node range was corrected, and the README wording about other Claude Code authentication settings softened.
- **Approval corrections (2026-09-16).** Two documentation corrections requested at approval: the attempt-limit wording above, and the `--system-prompt-file` note. One test was added to `tests/unit/claude-subscription.test.ts`, because the one-attempt cap was previously asserted only on the first invocation, not on the retry invocation. No implementation code changed.
- **Mutation check on the final code.** Removing or breaking any of the following fails the suite:
  - argv wiring, API-key removal (explicit and default env), the per-invocation CLI attempt cap;
  - the schema-rejection mapping, `is_error` handling, output precedence;
  - SIGKILL escalation, the forced settle, the exit handler, the post-exit deadline guard, kill-on-timeout;
  - the private working directory and each of its checks (mode, symlink, owner, no-uid platforms, fallback, reuse, cached re-check);
  - working-directory error mapping, issue bounds, the single PCF retry (removed, or a third invocation allowed), serialization, prompt-in-argv, stdout/stderr separation.

## Deviations from SPEC.md
- none.

## Blockers
- none

## Next action
Phase 2 is approved and checkpointed. The next phase in `EXECUTION_PLAN.md` is Phase 3, capture intelligence: raw capture first, extraction, concept persistence, claims, house classifier, and fallback behavior (SPEC §41; acceptance: capture integration suite green). It has not started and requires explicit authorization.

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

## Phase 1 deviations from SPEC.md
- none.

## Phase 1 blockers
- none

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

## Phase 0 dependencies added
Runtime: `next`, `react`, `react-dom`, `better-sqlite3`.
Dev: `typescript` (5.x), `@types/node`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`, `vitest`, `@playwright/test`, `tsx` (runs `scripts/*.ts`).
Not added yet (later phases): `zod` (Phase 1), `@anthropic-ai/sdk` (never).

## Phase 0 interpretation decisions (non-blocking)
- Styling: plain `app/globals.css` with class names (no Tailwind, no CSS modules) — least scaffold code (SPEC §6).
- `lib/db/migrations/` is intentionally empty in Phase 0; the runner is tested against `tests/fixtures/migrations/`. The frozen `001_initial.sql` is delivered in Phase 1 ("migration").
- `openDatabase(path?)` accepts a path (env `PCF_DB_PATH` or argument) so tests use `:memory:`; default remains `./data/pcf.db`.
- Today shell is static: capture textarea renders but does not submit (capture pipeline is Phase 3). The constellation pane renders the empty astrolabe scaffold only (SPEC §25G).
- `npm test` runs Vitest only; Playwright runs via `npm run test:e2e` on port 3210 with `reuseExistingServer: false` so it can never attach to an unrelated dev server on 3000.
- Next 16's `next dev` auto-appends an "agent rules" block to `CLAUDE.md` when it detects an AI agent. `AGENTS.md` was added so that block lands there and `CLAUDE.md` stays byte-identical to the frozen handoff.
- Next's build rewrote `tsconfig.json` (`jsx: react-jsx`, extra `.next/dev/types` include); kept as-is.

## Phase 0 deviations from SPEC.md
- none. `SPEC.md` unchanged. `AGENTS.md` is a tooling file, not a product surface.

## Phase 0 blockers
- none

## Phase log
| Phase | Status | Gate result |
|-------|--------|-------------|
| 0 — Scaffold | approved, tag `pcf-v0.1-phase-0` | npm test PASS, npm run build PASS |
| 1 — Domain + persistence | approved, tag `pcf-v0.1-phase-1` | npm test PASS (27), npm run build PASS |
| 2 — Claude subscription adapter | approved, tag `pcf-v0.1-phase-2` | npm test PASS (87), npm run build PASS, e2e PASS, preflight PASS 5/5 |
| 3 — Capture intelligence | not started | — |
| 4 — Relevance + constellation | not started | — |
| 5 — Four operators | not started | — |
| 6 — Cognitive return | not started | — |
| 7 — Product polish | not started | — |
