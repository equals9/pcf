# PCF Builder Handoff — START HERE

This directory contains the complete builder handoff for the **Personal Cognitive Field v0.1** project.

## The two rules that matter most

> **`SPEC.md` is the authoritative v0.1 product, architecture, acceptance, and scope contract.**

> **The current Claude Code prompt controls which build phase is authorized right now.**

The research and future-architecture documents are intentionally included so current choices do not paint PCF into a corner, but they are **not permission to implement additional features**. The initial prompt authorizes **Phase 0 only**, even though the frozen spec contains an older general instruction about proceeding through all phases.

---

# Files

## Root — give these directly to Claude Code

### `SPEC.md`
Frozen PCF v0.1 Product Constitution & Implementation Specification.

**Authoritative. Do not edit during normal implementation.**

### `CLAUDE.md`
Repository-level instructions for Claude Code: authority hierarchy, scope guard, subscription boundary, phase-gating rules, and completion protocol.

### `BUILD_STATUS.md`
Initial build status. Claude updates this during every phase.

### `OPEN_QUESTIONS.md`
Only genuine blockers go here. It is not a wishlist.

### `EXECUTION_PLAN.md`
Human/AI execution plan from Phase 0 through Phase 7, including review and Git checkpoint discipline.

---

## `docs/`

### `OBSIDIAN_ROAM_PLUGIN_RESEARCH.md`
Research mining Obsidian core/community plugins and Roam/RoamJS for proven cognitive primitives.

**Context only.** It must not broaden v0.1.

### `FIELDS_AND_LENSES_ADDENDUM.md`
Architecture analysis of Freeze/Parallel Cognitive Fields and AI-generated Lenses.

Conclusion: neither changes the foundational PCF data model; both are additive post-v0.1 projections.

**Context only.**

### `POST_V0.1_ROADMAP.md`
Candidate roadmap after the cognitive loop has been validated.

**Context only.**

---

## `prompts/`

### `PHASE_0_KICKOFF.txt`
Exact prompt to paste into the first `omni claude` coding session.

---

## `human-readable/`

DOCX copies of the frozen specification and plugin research for human review/reference.

Claude Code should primarily use the Markdown files.

---

# Recommended launch procedure

## 1. Create the repo

```bash
mkdir -p ~/Projects/pcf
cd ~/Projects/pcf
```

Copy **the contents of this handoff directory** into `~/Projects/pcf`.

After copying, the root should contain at least:

```text
pcf/
├── SPEC.md
├── CLAUDE.md
├── BUILD_STATUS.md
├── OPEN_QUESTIONS.md
├── EXECUTION_PLAN.md
├── START_HERE.md
├── docs/
├── prompts/
└── human-readable/
```

## 2. Initialize Git

```bash
git init
git branch -M main
git add .
git commit -m "Freeze PCF v0.1 build contract and builder handoff"
```

## 3. Launch Claude Code through Omnigent

```bash
omnigent claude
```

Optionally confirm:

```text
/status
```

Expected login method:

```text
Claude Max account
```

## 4. Paste the kickoff prompt

Open:

```text
prompts/PHASE_0_KICKOFF.txt
```

and paste it into Claude Code.

## 5. Let Claude complete Phase 0 only

Do not tell it to continue through all phases.

When Claude reports Phase 0 complete, capture its:

- final report
- repo tree
- `BUILD_STATUS.md`
- `OPEN_QUESTIONS.md`
- dependency list
- `npm test` output
- `npm run build` output

Review those before authorizing Phase 1.

---

# Why the process is deliberately gated

PCF is trying to model durable cognitive state. The development process should follow the same principle:

```text
make one state transition
        ↓
verify it
        ↓
record it
        ↓
continue
```

The danger is not that Claude cannot build quickly. The danger is that an incorrect early assumption can compound through six autonomous phases.

Phase checkpoints preserve reversibility.

---

# Canonical product shorthand

PCF is not an AI note app.

It is:

> A time-first, local-first cognitive environment in which persistent user-owned memory is structured into objects, relations, claims, events, and semantic coordinates, while replaceable AI reasoners surface relevant memory, contradictions, and adjacent possibilities that help thought become more capable over time.

Product grammar:

```text
Object   = unit of cognition
Time     = when cognition exists or changes
Field    = relational context around cognition
Lens     = rule for looking across cognition
Operator = transformation applied to cognition
```

Only the first three foundations required by `SPEC.md` should influence v0.1 implementation; Fields/Lenses beyond the v0.1 Constellation are post-v0.1 context.
