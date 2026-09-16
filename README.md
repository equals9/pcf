# PCF — Personal Cognitive Field v0.1

A time-first, local-first cognitive environment. See `SPEC.md` (frozen build contract) and `START_HERE.md`.

## Privacy boundary

Your persistent memory is stored locally. Only selected context is sent to the configured reasoning provider when AI reasoning is invoked.

## Commands

```bash
npm install
npm run migrate   # apply SQLite migrations to ./data/pcf.db
npm run dev       # open Today at http://localhost:3000
npm test          # unit/integration tests (Vitest, mock reasoner only)
npm run test:e2e  # UI acceptance tests (Playwright)
npm run build
```

## Build status

See `BUILD_STATUS.md` for the current phase and gate results.
