# PCF v0.1 Claude Code Execution Plan

## Objective

Build the frozen PCF v0.1 specification in small, inspectable, reversible phases through `omni claude`, using the user's authenticated Claude subscription.

The goal is not maximum autonomy. The goal is controlled autonomous execution with phase gates.

## Execution protocol override for the initial build

The product specification remains frozen. However, the current user-approved build cadence is **phase-gated**. For the first coding session, only Phase 0 is authorized. Claude must stop after the phase acceptance gates and wait for explicit approval. This intentionally narrows the older general autonomy wording in `SPEC.md` section 46 without changing any technical requirement.

---

# 1. Before coding

Confirm from Terminal:

```bash
claude
```

`/status` should report the user's Claude Max subscription.

Then exit Claude and enter the PCF repository.

Recommended location:

```bash
mkdir -p ~/Projects/pcf
cd ~/Projects/pcf
```

Copy the contents of this handoff package into that directory.

Initialize Git:

```bash
git init
git branch -M main
git add .
git commit -m "Freeze PCF v0.1 build contract and builder handoff"
```

Run:

```bash
omnigent claude
```

The resulting Claude Code `/status` should still report the Claude subscription login.

---

# 2. Authoritative files

Claude must be told:

```text
SPEC.md is authoritative.
CLAUDE.md contains repository operating rules.
BUILD_STATUS.md controls the current phase.
OPEN_QUESTIONS.md contains blockers.
docs/* is context only unless SPEC.md is explicitly amended.
```

---

# 3. Build cadence

Use one phase at a time:

```text
Phase 0
  ↓ tests + build
HUMAN REVIEW / GIT CHECKPOINT
  ↓
Phase 1
  ↓ tests + build
HUMAN REVIEW / GIT CHECKPOINT
  ↓
Phase 2
  ...
```

Do not give Claude blanket permission to run through all phases during the first implementation session.

---

# 4. Phase sequence

## Phase 0 — Scaffold

Deliver only:

- Next.js
- TypeScript
- SQLite connection
- migration runner
- Vitest
- Playwright
- basic Today shell

Gate:

```bash
npm test
npm run build
```

Then STOP.

## Phase 1 — Domain + persistence

Only after Phase 0 approval:

- domain types
- Zod schemas
- migration
- repositories
- event writes
- seed script

Gate: database integration tests green.

Then STOP.

## Phase 2 — Claude subscription adapter

- Reasoner interface
- ClaudeSubscriptionReasoner
- MockReasoner
- preflight
- structured-output validation

No Anthropic SDK/API key.

Then STOP.

## Phase 3 — Capture intelligence

- raw capture first
- extraction
- concept persistence
- claims
- house classifier
- fallback behavior

Then STOP.

## Phase 4 — Relevance + constellation

- deterministic relevance
- MMR
- relation candidate retrieval
- bounded relation inference
- deterministic geometry
- SVG constellation

Then STOP.

## Phase 5 — Four operators

- ☿ Connect
- ♃ Expand
- ♄ Challenge
- ♂ Act
- retrieval packets
- operator persistence
- feedback

Then STOP.

## Phase 6 — Cognitive return

- resurfacing
- contradiction detection
- Return card
- Tension card

Then STOP.

## Phase 7 — Product polish

Only:

- spacing
- typography
- loading/error states
- keyboard usability
- basic accessibility

No feature expansion.

Then run full Definition of Done audit.

---

# 5. Git checkpoint discipline

After each accepted phase:

```bash
git status
git add .
git commit -m "Complete PCF Phase N: <short name>"
```

Optionally create tags:

```bash
git tag pcf-v0.1-phase-N
```

This makes every architectural transition reversible.

---

# 6. Review checklist after each phase

Before approving the next phase, inspect:

- repo tree
- new dependencies
- tests added
- tests actually run
- `npm run build`
- files changed
- new architecture not required by the spec
- unexpected cloud/API dependencies
- hidden scope creep
- changes to `SPEC.md` (should be none)
- `OPEN_QUESTIONS.md`
- `BUILD_STATUS.md`

Any unnecessary abstraction should be removed before continuing.

---

# 7. Scope-creep red flags

Stop the build if Claude introduces without explicit amendment:

- Supabase/Firebase/cloud DB
- auth/users
- workspaces
- plugins
- embeddings/vector DB during v0.1
- background agent swarm
- OpenAI/Gemini/Codex integrations
- generic chat surface
- dashboard builder
- document editor
- task manager
- calendar product
- generic canvas
- global graph
- natal/transit astrology engine
- Fields/Lenses before v0.1 completion

---

# 8. Success criterion

The technical Definition of Done is in `SPEC.md`.

The product validation comes afterward:

Use PCF naturally for 20–50 real thoughts over several days and ask whether it produces repeated:

> "Wait — I hadn't connected those before."

If it does not, improve retrieval and cognitive operators before expanding feature scope.
