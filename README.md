# PCF — Personal Cognitive Field v0.1

A time-first, local-first cognitive environment. See `SPEC.md` (frozen build contract) and `START_HERE.md`.

## Privacy boundary

Your persistent memory is stored locally. Only selected context is sent to the configured reasoning provider when AI reasoning is invoked.

## Prerequisites

- Node.js 22.12 or later on the 22 line, or 24 or later (the range in `package.json` `engines`).
- Claude Code installed as `claude` on your `PATH`, logged in with your Claude subscription. Run `claude`, then `/status`, and confirm the login method is your Claude account.

PCF never asks for, stores, or reads an Anthropic API key. AI reasoning runs through the installed `claude` CLI in print mode, using your logged-in subscription and your Claude Code default model. If an API key is exported in your shell, PCF removes it from the environment of the `claude` processes it starts so that key is not used. Other authentication settings you have configured for Claude Code are left as they are, so confirm with `/status` that your Claude account is the active login.

## Commands

```bash
npm install
npm run migrate    # apply SQLite migrations to ./data/pcf.db
npm run seed       # optional: load the synthetic demo dataset
npm run preflight  # manual check that Claude Code and the database are ready
npm run dev        # open Today at http://localhost:3000
npm test           # unit/integration tests (mock reasoner and fake CLI only)
npm run test:e2e   # UI acceptance tests (Playwright, port 3210)
npm run build
```

## Manual preflight

Run this once after installing, and again whenever Claude Code is updated or re-authenticated:

```bash
npm run preflight
```

It runs five checks and exits non-zero if any fail:

| Check | What it does |
|-------|--------------|
| claude on PATH | Finds the `claude` executable. |
| claude --version | Confirms the CLI starts. |
| non-interactive invocation | Sends one tiny structured request through your subscription and validates the JSON reply. This is the only check that uses Claude. |
| database directory writable | Writes and removes a probe file next to the database. |
| SQLite migration | Opens the database and applies any pending migrations. |

Preflight never reads or prints credentials. Automated tests never call Claude.

If the invocation check fails with `unavailable`, open `claude`, run `/status`, and log in again if needed. Run preflight from a normal terminal: shells inside other Claude Code sessions carry session-specific variables that can change how a nested `claude` call is routed.

## Build status

See `BUILD_STATUS.md` for the current phase and gate results.
