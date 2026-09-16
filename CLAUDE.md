# Claude Code Repository Instructions — PCF

## Authority hierarchy

Use this priority order at all times:

1. **The user's explicit instruction in the current Claude Code session** — controls what phase/action is authorized now.
2. **`SPEC.md`** — frozen authoritative v0.1 product, architecture, acceptance, and scope contract.
3. **`BUILD_STATUS.md`** — current phase and gate status.
4. **`OPEN_QUESTIONS.md`** — unresolved blockers only.
5. Other files under `docs/` — context/research/future architecture only; they are NOT v0.1 requirements.

If any contextual document appears to conflict with `SPEC.md`, `SPEC.md` wins. A current user instruction may restrict execution to a smaller subset of the work (for example, Phase 0 only) without amending the product specification.

### Important execution-cadence clarification

`SPEC.md` section 46 contains an earlier general instruction to continue through the phases. The **current approved execution protocol is stricter**: execute only the phase explicitly authorized by the user, report results, then STOP for review. This changes execution cadence only; it does not modify any product, architecture, test, or Definition-of-Done requirement in `SPEC.md`.

## Core operating rules

- Read `SPEC.md` completely before implementation.
- Do not edit `SPEC.md` unless the user explicitly instructs you to amend the frozen contract.
- Work one build phase at a time.
- Do not begin the next phase until the user explicitly approves continuation.
- Prefer the smallest correct implementation satisfying the current phase acceptance gates.
- Do not add "helpful" features, abstractions, services, product surfaces, or dependencies outside the current phase.
- If a requirement is ambiguous but non-blocking, choose the simpler interpretation and document it in `BUILD_STATUS.md`.
- If a requirement truly blocks progress, record it in `OPEN_QUESTIONS.md` and continue all unblocked work.
- Never use context documents as permission to implement post-v0.1 features.

## Architecture invariants

- local-first
- single-user
- SQLite canonical persistence
- stable CognitiveObject IDs
- Claude is a replaceable reasoner, never canonical memory
- raw capture persists before AI enrichment
- structured AI output must be schema-validated before persistence
- cognitive history is preserved
- graph shown to user is contextual, not a global hairball
- user remains authority over beliefs/relations/resolution

## Claude subscription boundary

The application must use the installed authenticated Claude Code CLI through the `Reasoner` adapter specified in `SPEC.md`.

Do not:

- add `@anthropic-ai/sdk`
- require or configure `ANTHROPIC_API_KEY`
- call Anthropic HTTP APIs directly
- expose authentication material

Before implementing invocation flags, inspect the current `claude --help` output and use documented supported non-interactive behavior.

Tests must use a deterministic mock Reasoner and must not consume subscription usage.

## Scope guard

During v0.1, do not implement anything from:

- `docs/FIELDS_AND_LENSES_ADDENDUM.md`
- `docs/POST_V0.1_ROADMAP.md`
- `docs/OBSIDIAN_ROAM_PLUGIN_RESEARCH.md`

unless the user explicitly amends `SPEC.md`.

These documents exist so architectural choices made in v0.1 do not accidentally foreclose important future capabilities.

## Phase completion protocol

At the end of every phase:

1. run the phase's required tests;
2. run `npm test` when available;
3. run `npm run build` when required by the spec;
4. update `BUILD_STATUS.md` with exact results;
5. summarize files/dependencies created or changed;
6. list any deviation from `SPEC.md`;
7. list blockers/open questions;
8. STOP and wait for explicit approval before entering the next phase.

Do not silently continue.
