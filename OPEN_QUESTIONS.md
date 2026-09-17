# Open Questions

Only genuine blockers belong here. This is not a wishlist.

## Which surface triggers the §28 capture retry?

- **Status:** open, raised 2026-09-17. It does not block any phase.
- **Gap:** SPEC §28 says an extraction failure must "store raw thought; mark metadata incomplete; allow retry". The engine provides `retryIncompleteCapture` (it re-runs extraction and fills in missing house scores), but §26 defines no retry route and §25 defines no retry control. The capture surface therefore shows the thought and says its title and concepts could not be extracted, with no way to retry from the app.
- **Decision needed:** whether a retry control belongs in v0.1 and, if so, which phase adds it and through which request (an existing §26 route or a spec amendment). The simplest option is Phase 7 error-state work, which is otherwise limited to polish.

## Resolved

### Which phase builds the capture API route and the Today capture UI? (resolved 2026-09-17)

The reviewer assigned `POST /api/capture` and the Today capture interaction (A3) to Phase 3, as the thin integration surface over the capture engine. The route returns after the synchronous pipeline finishes. The raw thought is still stored before any Claude call, and v0.1 adds no queues, workers or polling. See `BUILD_STATUS.md`.
