# Open Questions

Only genuine blockers belong here. This is not a wishlist.

## Which surface triggers the §28 capture retry?

- **Status:** open, raised 2026-09-17. It does not block any phase.
- **Gap:** SPEC §28 says an extraction failure must "store raw thought; mark metadata incomplete; allow retry". The engine provides `retryIncompleteCapture` (it re-runs extraction and fills in missing house scores), but §26 defines no retry route and §25 defines no retry control. The capture surface therefore shows the thought and says its title and concepts could not be extracted, with no way to retry from the app.
- **Decision needed:** whether a retry control belongs in v0.1 and, if so, which phase adds it and through which request (an existing §26 route or a spec amendment). The simplest option is Phase 7 error-state work, which is otherwise limited to polish.

## Crowded house sectors overlap visually (accepted for v0.1)

- **Status:** accepted 2026-09-17 as a v0.1 limitation, kept here as a future research item. Not a blocker.
- **Ruling:** the deterministic §21 geometry remains the v0.1 implementation contract. Do not widen the angular jitter, shrink the node-radius range, add force-directed layout or collision simulation, add WebGL, amend `SPEC.md`, or redesign the renderer. Overlap belongs to future renderer/layout research for the higher-fidelity PCF visual system.
- **Gap:** SPEC §21 fixes the geometry: 30° sectors, at most ±10° of jitter, `radius = 90 + (1 - R) * 110`, node radius `8 + activation * 8`. When many thoughts share one dominant house, that envelope is too small to keep the circles apart: five nodes of radius 12 in one sector can only be about 5° apart, so they touch, and a node painted later can cover an earlier node's centre. §25G says "Clicking a node changes current focus", which then fails for the covered node.
- **Current state:** nodes sharing a sector are spread evenly across the ±10° band, which keeps every node's centre clear on the §35 seed (verified for all 15 anchors). Every node is also reachable from the text list beneath the dial, so no thought is unreachable. Crowded sectors still overlap visually.
- **Future research:** how a higher-fidelity renderer should place many nodes in one house sector while keeping layout deterministic and inspectable. Any such change amends §21 and needs explicit approval.

## Saturn's first model attempt is often rejected

- **Status:** open, raised 2026-09-18 during the Phase 5 live preflight. It does not block Phase 5.
- **Observation:** across five live Challenge invocations, the first CLI attempt failed three times with an error envelope (exit 1, zero output tokens after about 0.8 s of API time), while Connect, Expand and Act each succeeded on their first attempt. The accepted single retry recovered it twice; once both attempts failed and the user saw the §28 message. Latency ranged from 30 s to 107 s. Nothing was persisted for the failures.
- **Current state:** this is provider-side behaviour reached through the frozen Phase 2 adapter, whose retry semantics are checkpointed and must not be layered on. PCF already reports the failure truthfully and stores nothing.
- **Decision needed:** whether to do anything in v0.1 — for example a user-facing "try again" control (which is the same question as the capture retry below), or leaving it as is and watching whether the provider behaviour settles.

## Can a proposed relation be accepted or rejected?

- **Status:** open, raised 2026-09-18. It does not block any phase.
- **Gap:** relations are created as `proposed` (Phase 3) and Mercury suggests more (Phase 5), but §26 defines no endpoint and §25 defines no control for accepting or rejecting one. RELATION_ACCEPTED and RELATION_REJECTED exist in §11, the schema supports both statuses, and §19 and the constellation both read them, so the data path is ready and only the user action is missing. SPEC P9 says the user remains the authority over relations.
- **Decision needed:** which phase gives the user that control, and through which request. Phase 6 works with the Tension card and may need it; otherwise Phase 7.

## Resolved

### Which phase builds the capture API route and the Today capture UI? (resolved 2026-09-17)

The reviewer assigned `POST /api/capture` and the Today capture interaction (A3) to Phase 3, as the thin integration surface over the capture engine. The route returns after the synchronous pipeline finishes. The raw thought is still stored before any Claude call, and v0.1 adds no queues, workers or polling. See `BUILD_STATUS.md`.
