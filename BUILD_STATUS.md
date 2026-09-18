# PCF Build Status

## Current phase
Phase 5 — Four cognitive operators: COMPLETE and approved. Checkpointed with tag `pcf-v0.1-phase-5`. Phase 6 not started.
Phase 4 approved and checkpointed at commit `fd76f9a`, tag `pcf-v0.1-phase-4`.

## Phase 5 requirements
- SPEC §41 Phase 5: Connect, Expand, Challenge, Act, retrieval packets, operator persistence, feedback buttons. Acceptance: all four structured contracts green.
- Contracts: SPEC §10 (frozen `operator_runs` and `feedback` tables), §11 (event types), §23 (packet and the four result shapes), §25C/§25D, §26 (`POST /api/object/:id/operator`, `POST /api/feedback`), §28, §29, §32 operator test, §33 A4, §37, §38, §39.

## Phase 5 as implemented
- **Retrieval packet (`lib/engine/operator-runner.ts`).** Exactly the §23 categories and nothing else:
  - `focus`: the anchor object.
  - `concepts`: the anchor's concepts.
  - `houseVector`: the anchor's stored vector. An object with no vector is refused (`not_classified`) rather than given an invented one.
  - `relatedObjects`: the Phase 3 §17 candidates, already ranked by §19 relevance, archived objects dropped, capped at 8.
  - `relations`: every persisted relation, with its status and origin, between two objects in the packet.
  - `claims`: the claims of the focus and of the related objects.
  - The packet is deterministic for fixed canonical state, and the whole prompt body is the packet as JSON. System prompts are fixed text and carry no user content.
- **One invocation.** `runOperator` makes exactly one `Reasoner.runStructured` call and never retries; the Phase 2 adapter still owns the single retry, so one click costs at most 2 CLI invocations of one model attempt each.
- **Result contracts.** Zod schemas mirror §23: Connect (max 3, `targetId` restricted to the packet's related objects), Expand (max 3, `groundedInObjectIds` non-empty and restricted to packet objects), Challenge (max 5 assumptions, failure modes and missing-evidence items, nullable alternative interpretation, confidence assessment), Act (max 5 steps). Output that breaks a contract is rejected and nothing is stored.
- **Persistence.** On success only, one immediate transaction writes one `operator_runs` row and one OPERATOR_INVOKED event. `input_context_json` records ids (focus, concepts, related objects, relations, claims) plus the house vector, so the packet stays reconstructable without duplicating content. Runs are never overwritten; repeated invocations are separate rows.
- **What an operator never does.** It does not touch raw content, claims, relations, house scores, concepts or history. A Connect suggestion stays a suggestion: no relation is created and no proposed relation is accepted. Tests pin each of these.
- **Feedback.** `recordFeedback` writes one `feedback` row and one FEEDBACK_RECORDED event for an existing operator run or object, and never modifies the run. v0.1 learns nothing from it (§39).
- **Routes.** `POST /api/object/:id/operator` returns `{runId, operator, result}` plus an additive `objects` list (id and title of the packet's objects) so results can name thoughts instead of raw ids. `POST /api/feedback` returns the stored record. Both are loopback-only, JSON-only adapters with no prompts, retrieval, retries or writes of their own. 404 for an unknown object, 409 `not_classified`, 503 with the §28 copy for a failed operation.
- **Today UI.** Each thought card carries exactly ☿ Connect, ♃ Expand, ♄ Challenge and ♂ Act below the text, outside the focus link, so invoking one is a fetch and never a navigation. While one runs, all four are disabled and the §38 wording is shown ("Connecting…", "Expanding…", "Challenging…", "Designing experiment…"). The result appears inline beneath the thought with Useful / Not useful, keyed by run id so a new result never inherits the previous result's feedback state. The capture draft, the constellation focus and the `?focus=` URL are untouched.

## Phase 5 acceptance gates (2026-09-18)
| Gate | Result |
|------|--------|
| `npm test` | PASS: 23 files, 330 tests |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS; `/api/object/[id]/operator` and `/api/feedback` render per request |
| `npm run test:e2e` | PASS: 55 passed, 1 production-only test skipped on dev; A1, A2, A3, A4, A5, A6 plus the capture, constellation and operator suites, against the production build and the dev server |
| SPEC §32 operator test | PASS: each of the four operators validates output, persists one `operator_run` and creates one OPERATOR_INVOKED event |
| Mutation checks | 20 of 20 injected regressions fail the suite, after the closure pass below added the missing test |
| Subscription boundary (§34) and no-real-claude guard | PASS |
| Loopback security | PASS: both new routes refuse a foreign Host or Origin, with no writes and no reasoner call |
| Future-research scan | none |
| `SPEC.md`, `CLAUDE.md`, migrations, schema, Phase 2 adapter, Phase 3/4 engines, research spec, dependencies | unchanged |

## Phase 5 live preflight (2026-09-18, real subscription)
One invocation of each operator on the stored thought "Keeping persistent AI memory outside model weights for inspectability" (6 concepts, 8 related objects, 5 relations, 7 claims; packet 9,131 characters).

| Operator | Latency | Outcome |
|---|---|---|
| ☿ Connect | 29.7 s | 3 connections, each citing a real packet object, with a reason the link is not obvious |
| ♃ Expand | 35.0 s | 3 possibilities, each citing supplied object ids and phrased as possibility, not fact |
| ♄ Challenge | 107.2 s | failed: both model attempts were rejected. Later diagnostic runs succeeded in 30-100 s |
| ♂ Act | 31.4 s | a concrete experiment with steps, success and failure criteria |

- Retrieval context was relevant: the packet carried the real seed thoughts on both sides of the memory argument, and the results used them by name.
- The four results were clearly differentiated: Connect found a support and a tension the user had not linked, Expand proposed adjacent framings with a next question, Challenge attacked the assumption that storage location implies inspectability, Act proposed a one-week editing test with recorded evidence.
- **Saturn is intermittent.** Across five live attempts its first CLI attempt failed three times with an error envelope (exit 1, zero output tokens after ~0.8 s of API time). The accepted single retry recovered it twice; once both attempts failed and the user-facing §28 message was shown. This is provider-side behaviour through the frozen adapter, not an operator defect: no run was persisted for the failure. Recorded in `OPEN_QUESTIONS.md`.
- The live preflight wrote exactly 3 `operator_runs` and 3 OPERATOR_INVOKED events, and created no objects, claims or relations. The anchor's raw content and `updated_at` are unchanged.

## Phase 5 closure pass (2026-09-18)
Two review items were resolved before checkpointing.

### 1. Act proposed an experiment PCF cannot run
The live preflight had Mars propose editing the anchor's corrupted raw text to see whether the edit propagated. Raw capture is immutable, so that experiment could never be carried out: a semantically relevant result that was operationally impossible.

- **Fix.** `PCF_OPERATING_CONSTRAINTS` in `lib/ai/prompts/operators.ts`: fixed operator text, added to Mars's system prompt only. It states that raw text is never edited, replaced, corrected or deleted, even when malformed; that extracted metadata, claims, relations, house scores and history are canonical and not rewritten, and that the user cannot accept or reject a proposed relation; exactly what the user can do today (capture, read Today, select a thought, run the four operators, rate a result); that nothing proposed is executed and no step has happened yet; and that an experiment may live outside PCF, with capture as the way to record a result. If the ideal experiment needs a capability PCF lacks, Mars must propose the nearest feasible experiment and name the missing capability rather than assume it.
- **Where.** The system prompt, not the retrieval packet: the packet stays user-derived canonical state. The other three operators are unchanged. Nothing was made editable, no capability, migration or dependency was added, and the adapter and its retry policy are untouched.
- **Regression tests** (`tests/integration/operators.test.ts`, "§23D Act feasibility"), built on the real failure mode — an anchor whose raw content is duplicated and truncated:
  - the contract reaches Mars in the system prompt, and each invariant is pinned separately (immutability; malformed content still not repairable; canonical records; no accept/reject; nothing executed; nearest feasible experiment; never assume a capability);
  - the contract is absent from the packet, and the malformed raw text reaches Mars exactly as captured;
  - the other three operators do not receive it;
  - the run leaves the raw thought, its claims, relations and house scores untouched;
  - Mars may still propose an experiment that captures new thoughts, and the operator records the proposal without creating anything itself.
  Four mutants confirm these tests bite: removing the contract, claiming content is correctable, moving the contract into the packet, and dropping the nearest-feasible rule are each caught.
- **Live rerun** (one Act invocation on the same anchor, 77.5 s): the experiment is now feasible end to end — read the corrupted text, capture a correction as a new thought, run operators on it, check whether the two thoughts retrieve each other, capture a verdict, rate the results. Its last evidence item names what cannot be tested: "PCF has no edit or delete, and no control to accept or reject a proposed relation". The other three operators were not rerun.

### 2. The surviving mutation, identified
- **Mutation.** Delete the in-flight guard (`if (inFlight.current) return; inFlight.current = true;`) from `invoke` in `components/operators/OperatorBar.tsx`.
- **Invariant.** One operator run per card at a time: one click, one Claude call, one `operator_run`.
- **Why the suite missed it.** The four buttons also carry `disabled={busy}`, and a disabled button fires no click, so every Playwright click path was already blocked. Removing `disabled` alone, or both guards, was caught; removing the ref alone was not.
- **Disposition: a real defect, not an equivalent mutant.** `disabled` only takes effect once React commits the render. In a production build that commit is deferred, so clicks dispatched in the same task — a fast double-click, or two operator buttons in quick succession — reach `invoke` before the buttons disable. The ref is the only thing that stops them.
- **Test added.** "two operator clicks in the same task run only one operator" dispatches three clicks inside one JS task. With the guard: one POST and one result. Without it: three POSTs, three Claude calls and three runs. Mutation score is now 20 of 20.

## Phase 5 delivered
- **Created:** `lib/engine/operator-runner.ts`; `lib/ai/prompts/operators.ts`; `app/api/object/[id]/operator/route.ts`; `app/api/feedback/route.ts`; `components/operators/OperatorBar.tsx` and `OperatorResult.tsx`; `tests/integration/operators.test.ts`; `tests/integration/operator-route.test.ts`; `tests/acceptance/operators.spec.ts`; `tests/fixtures/operator-fixtures.ts`.
- **Modified:** `components/today/ThoughtCard.tsx` (operator bar below the text, outside the focus link); `app/globals.css`; `tests/fixtures/e2e-bin/claude` (operator answers for the fake CLI).
- **Dependencies added:** none.

## Phase 5 interpretation decisions (non-blocking)
- **Related objects.** §23 caps them at 8 but does not say how to choose them, so Phase 5 reuses the Phase 3 §17 candidates (already §19-ranked) rather than adding a second retrieval path. Archived objects are dropped: the user put them away.
- **Unclassified anchors.** §23's packet requires a `houseVector`. An object without one is refused with a truthful message instead of being sent a fabricated vector, so all four operators are unavailable until classification succeeds.
- **Relations and claims in the packet.** Only relations whose both ends are in the packet, so no id dangles; claims of the focus and of the related objects. Rejected relations are included with their status, so an operator can see that a link was declined.
- **Connect never persists.** §23A says no new object is created automatically, and §26 defines no accept endpoint, so connections are shown as suggestions only. Accepting one is not possible in v0.1; see `OPEN_QUESTIONS.md`.
- **Operator response.** The §26 response carries `runId`, `operator` and `result`, plus an additive `objects` list so the UI can name cited thoughts instead of printing raw ids.
- **Feedback targets.** `operator_run` (the §26 example) and `object`. Both are validated to exist before anything is written.
- **`input_context_json`.** Ids plus the house vector, not copies of the content, so history stays inspectable without duplicating canonical text.
- **One operator at a time per card.** A run disables the card's four buttons; a second result replaces the first on screen. Runs remain in the database either way.

## Phase 5 review (2026-09-18)
- **Lenses.** Seven: retrieval integrity, epistemic integrity, persistence integrity, security and the Claude boundary, UI state, scope and test strength, partial and adversarial state. Three skeptics per finding; 34 findings, 8 survived, which were 3 distinct issues, all fixed:
  1. **Feedback state leaked between results (high, found by five lenses).** After rating one result, the next result on the same card rendered "Thanks — recorded." and could never be rated, because React preserved the feedback control's state. The result is now keyed by run id, and an acceptance test rates two results in a row.
  2. **Frozen §23 caps were not pinned (medium).** The cap tests built their fixtures from the constants they were testing, so widening a constant passed. The numbers are now asserted as literals and the over-long fixtures use literals.
  3. **A layered retry would not have been caught (medium).** Failure-path tests did not assert the call count, so an engine-level retry passed. They now assert exactly one reasoner call.
- **Rejected by the skeptics (26).** Including: archived candidates consuming packet slots before the filter, a previous result staying on screen after a failure, the §28 copy on the `not_classified` path, unbounded related-object content, and several accessibility suggestions.

## Phase 5 deviations from SPEC.md
- none.

## Phase 5 blockers
- none. `OPEN_QUESTIONS.md` records the Saturn retry behaviour, the still-unassigned capture retry and the missing accept/reject control for proposed relations.

## Accepted Phase 5 decisions (approved 2026-09-18)
- **Act feasibility.** The fixed Mars operating-constraints contract stays in the operator's system prompt, outside the user-derived retrieval packet. Raw capture stays immutable, including malformed, duplicated or truncated captures. Act may propose feasible actions, experiments outside PCF, and capturing new observations as new thoughts. Act may not edit or replace historical raw capture, silently rewrite canonical state, assume capabilities that do not exist, execute anything for the user, or assume a proposed action has already happened.
- **Mutation guard.** The synchronous `inFlight` guard stays, independently of React's `disabled` state, and the same-task multiple-click regression test is required.
- **Saturn reliability.** The Claude adapter and its retry behaviour are unchanged; there is no Challenge-specific retry path. The provider-side zero-output failure stays documented for observation.
- **Relation accept/reject and capture retry.** Both remain open questions; neither was implemented at checkpoint.

## Next action
Wait for explicit approval before Phase 6: cognitive return — resurfacing, contradiction detection, the Return card and the Tension card.

## Phase 4 requirements
- SPEC §41 Phase 4: relevance score, MMR, relation candidates, relation inference, deterministic constellation geometry, SVG visualization. Acceptance: constellation tests green.
- Relevance (§19), §17 candidate retrieval and §18 relation inference were built in Phase 3 under the recorded phase-boundary resolution, and are reused here, not reimplemented.
- Contracts: SPEC §9 (frozen node and edge types), §20, §21, §25C, §25G, §26 (`GET /api/object/:id/constellation`), §31 (MMR and layout determinism), §33 A5 and A6, §37, §38.

## Phase 4 as implemented
- **Projection (`lib/engine/constellation.ts`).** `buildConstellation(db, anchorId)` returns the anchor, at most 12 nodes and the edges between them, or null for an unknown anchor.
  1. **Candidates.** Objects sharing a concept with the anchor, objects scoring >= 0.35 in a house where the anchor also scores >= 0.35, the 2 most recent objects, and every object the anchor is directly related to. Excluded: the anchor, archived objects, objects with no house vector yet, and objects whose only link is a rejected relation. Each unbounded arm is capped at the 96 most recent matches so one projection cannot scan the whole store (§38).
  2. **Ranking.** §19 relevance, reusing the Phase 3 functions.
  3. **§20 MMR.** `0.78 * relevance - 0.22 * maxSimilarity(selected)`, redundancy = `0.60 * concept similarity + 0.40 * house cosine`, until 12 nodes or the candidates run out. Ties: higher relevance, then the newer object, then the lower id, so the result does not depend on input order.
  4. **§21 geometry.** Dominant house (ties to the lowest house), sector centre `-90° + (n - 1) * 30°`, `radius = 90 + (1 - R) * 110`, node radius `8 + activation * 8`, and angular jitter within ±10°: the nodes that share a sector are spread evenly across the band in a stable id-hash order. Coordinates are absolute in a 432 x 432 drawing space whose centre is the anchor.
  5. **Edges.** Only persisted, non-rejected relations between visible objects, once each, with the stored type and confidence. Never similarity, never proximity.
- **`GET /api/object/:id/constellation`** (§26): loopback-only, adapter over the engine, 404 for an unknown object, 500 with a content-free log on a database failure. It ranks nothing itself.
- **Today (§25G).** The selected object lives in the URL (`/?focus=<id>`), so the page is server-rendered, shareable and needs no client state. The anchor is the selected object, else the latest object today, else an empty scaffold with no fake nodes. Thought cards, dial nodes and the text list all link to focus, so selection is a normal navigation.
- **Accessibility (§37).** Every node is a keyboard-reachable link with an aria-label naming the thought and its house, and the same nodes are repeated as a text list under the dial, so the graph is readable without the picture.

## Phase 4 acceptance gates (2026-09-17)
| Gate | Result |
|------|--------|
| `npm test` | PASS: 21 files, 267 tests |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS; `/`, `/api/capture` and `/api/object/[id]/constellation` render per request |
| `npm run test:e2e` | PASS: A1, A2, A3, A5, A6 and the capture tests, against the production build and the dev server (37 passed, 1 production-only test skipped on dev), run twice with the same result |
| SPEC §31 MMR test | PASS: three near-duplicates do not take the top slots from a comparably relevant diverse candidate |
| SPEC §31 layout determinism | PASS: repeated builds give identical coordinates; pinned values guard the formulas |
| Mutation checks | 18 of 18 injected regressions fail the suite (weights, cap, jitter, hash, sector angle, radius, node size, unclassified objects, pool bound, archived, rejected relations, edge visibility, anchor resolution, list navigation, route checks) |
| Future-research terms in new code | none |
| `SPEC.md`, `CLAUDE.md`, migrations, schema, Phase 2 adapter files, dependencies | unchanged |

## Phase 4 delivered
- **Created:** `lib/engine/constellation.ts`; `app/api/object/[id]/constellation/route.ts`; `components/constellation/ConstellationGraph.tsx`, `ConstellationNode.tsx`, `ConstellationEdge.tsx`; `tests/unit/constellation.test.ts`; `tests/integration/constellation.test.ts`; `tests/integration/constellation-route.test.ts`.
- **Modified:** `components/constellation/ConstellationPane.tsx` (graph or scaffold), `components/today/TodayView.tsx` (anchor resolution), `ThoughtStream.tsx` and `ThoughtCard.tsx` (selection links, selected state), `app/page.tsx` (focus search param), `app/globals.css`; `lib/db/repositories/objects.ts` and `concepts.ts` (bounded pool queries, additive); `tests/fixtures/e2e-server.mjs` (seeds the temporary database); `playwright.config.ts` (timeouts); `tests/acceptance/today.spec.ts` (A5, A6, draft-preservation).
- **Dependencies added:** none.

## Phase 4 interpretation decisions (non-blocking)
- **Constellation candidates.** SPEC does not define the pool for §21, only for §17. Phase 4 reuses the §17 pool and adds the anchor's directly related objects, since a linked thought should be able to appear in its own projection. Each unbounded arm keeps the 96 most recent matches (8 per node slot), which is deterministic and bounds the work.
- **Unclassified objects.** §21 places a candidate in "its highest-scoring house". An object still waiting for classification has none, so it stays out of the dial instead of being drawn under a house it was never given. It still appears in the Today stream.
- **Angular jitter.** §21 asks for deterministic distribution within the sector using stable id hashing, capped at ±10°. Nodes that share a sector are therefore spread evenly across the band in id-hash order, rather than each taking an independent hash offset, which left them on top of each other.
- **Drawing space.** §21 fixes the formulas but not the canvas. Coordinates are absolute in a 432 x 432 box (centre 216 = 90 + 110 + 16), so the widest node still fits.
- **Selection state.** §25G requires a selected anchor but names no mechanism. The selection is a URL search param, so Today stays a server component and no client state is needed.
- **Edge appearance.** §21 allows distinguishing accepted from proposed. The frozen §9 edge type carries no status, so all edges render alike, with opacity from confidence.

## Phase 4 review (2026-09-17)
- **Lenses.** Four: algorithm conformance, data correctness, UI and Next.js behaviour, test strength. Three skeptics per finding. Of 24 findings, 7 survived (5 distinct issues) and all are fixed:
  1. **Overlapping nodes (high).** Jitter came from each id alone, so nodes sharing a house landed within about 1° of each other; on the seed, pairs sat 0.9 px apart and the later-painted circle covered the earlier one, making it unclickable. Sector-relative spreading fixes it.
  2. **Hash collapse (medium).** `stableUnitHash` took FNV-1a's high bits with no avalanche step, so ids sharing a prefix (`seed-01`, `seed-02`, ...) spanned 6% of the range. A finalizer now spreads them over 85%.
  3. **Unbounded pool (medium).** Scoring every object sharing a house made a projection take 406 ms at 10,000 objects, against §38's 150 ms interaction target. Each unbounded arm is now capped.
  4. **Invented house (medium).** An object with no house vector was drawn and announced as "1 · Self" while the same page's stream showed no house for it. Such objects are now left out of the dial.
  5. **Full page reload (medium).** The text list used a plain anchor, so selecting a thought there reloaded the document and discarded unsent capture text. It uses `next/link` like every other link now.
- **Rejected by the skeptics (17).** Including: `role="img"` hiding the node links (disproved in a real browser), an anchor with no concepts getting a 2-node constellation (SPEC allows it), and several test-coverage suggestions that are now covered anyway.
- **Found while fixing.** A5 could not click an arbitrary node when a house sector is crowded: the ±10° cap cannot separate many circles of radius 12. The test now clicks the topmost node, and the limit is recorded in `OPEN_QUESTIONS.md`.

## Phase 4 deviations from SPEC.md
- none.

## Accepted limitation: crowded house sectors (approved 2026-09-17)
The frozen §21 geometry cannot keep node circles apart when many thoughts share one dominant house. The reviewer accepted this for v0.1. The deterministic geometry stays the implementation contract, and the following are explicitly out of bounds: widening the angular jitter, shrinking the node-radius range, force-directed layout, collision simulation, WebGL, amending `SPEC.md`, or redesigning the renderer. Visual overlap is a future renderer/layout research item for the later higher-fidelity PCF visual system, and stays documented in `OPEN_QUESTIONS.md`.

## Phase 4 blockers
- none. `OPEN_QUESTIONS.md` records the accepted crowded-sector limitation and the still-unassigned capture retry.

## Next action
Phase 4 is checkpointed. Wait for explicit approval before Phase 5: the four cognitive operators (§23), retrieval packets, operator persistence and feedback buttons on the thought cards. Phase 5 routes must apply the loopback check, and the operator buttons will need the card's link structure revisited.

## Phase 3 requirements
- SPEC §41 Phase 3: raw capture, extraction, concept persistence, claim persistence, house classifier, fallback behavior. Acceptance: capture integration suite green.
- The Phase 3 authorization covers the full SPEC §15 capture pipeline, including steps 12-14 (relation candidates, bounded relation inference, proposed relations).
- Contracts: SPEC §13, §14, §15, §17, §18, §19 (ranking only), §28, §29, §30, §32.
- Capture surface, assigned to Phase 3 by the reviewer on 2026-09-17: SPEC §26 `POST /api/capture`, the §25B CaptureBox and §25C ThoughtStream wiring, and UI acceptance test A3 (§33). The route returns after the synchronous pipeline finishes; no queues, workers, polling or status machines.

## Phase 3 scope note
SPEC §41 and `EXECUTION_PLAN.md` list relation candidate retrieval and bounded relation inference under Phase 4, while §15 includes them in the capture pipeline. The Phase 3 execution instruction explicitly authorized them, and the human reviewer accepted the result on 2026-09-17.

Authorized phase-boundary resolution: Phase 3 owns the relation machinery required by the frozen capture pipeline: bounded candidate selection, the §19 relevance calculation needed to rank those candidates, and bounded proposed-relation inference. Phase 4 must reuse these primitives and owns MMR reranking, contextual constellation selection, deterministic constellation layout and visualization. Phase 4 must not independently reimplement the Phase 3 capture relation pipeline.

This is an execution-boundary clarification. `SPEC.md` and `EXECUTION_PLAN.md` are unchanged.

The capture API route (§26 `POST /api/capture`) and the Today capture interaction (A3) were also assigned to Phase 3 by the reviewer on 2026-09-17, as the thin integration surface over the capture engine.

## Phase 3 pipeline as implemented (`lib/engine/capture.ts`)
1. Validate: content must be a non-empty string after trimming; it is stored exactly as typed. Invalid input throws and writes nothing.
2. One transaction: insert the object (type `thought`, provenance `user`, title null, importance and activation 0.5, status `active`), then append OBJECT_CAPTURED. This commits before any reasoner call.
3. Extraction: one reasoner call. On success, one immediate transaction updates type, title and importance, upserts and attaches concepts, inserts claims, then appends OBJECT_EXTRACTED. It re-checks inside the transaction and writes nothing if an extraction was already committed.
4. Houses: one reasoner call, using content, the extracted title and the concept names. On success, one immediate transaction writes all 12 rows and appends HOUSE_CLASSIFIED `{source: "model", dominantHouses, rationale}`. On invalid output, an outage or a write failure, it writes the §13 fallback in the same way with `{source: "fallback", reason}`. If even the fallback cannot be written, the status is `houses: "failed"` and the object has no house rows until a retry.
5. Candidates (§17): the pool is objects sharing a concept, plus objects scoring >= 0.35 in a house where the new object also scores >= 0.35, plus the 2 most recent objects. The new object is excluded. The pool is ranked by §19 relevance, ties go to the newer object then the lower id, and the top 8 are kept. With no candidates, no reasoner call is made.
6. Relation inference (§18): one reasoner call. The schema allows at most 3 proposals, restricts targets to the candidate ids and requires frozen relation types. Proposals below 0.55 are dropped, and duplicates of a (target, type) pair keep the most confident. A proposal is skipped if the same relation already exists, in either direction for the symmetric types `related_to`, `analogous_to` and `contradicts`. One immediate transaction inserts relations as `status: "proposed"`, `origin: "ai_inferred"`, each followed by RELATION_PROPOSED.
7. The result is the stored object, house vector, concepts and relations, plus `enrichment: {extraction, houses, relations}`.
8. Any unexpected error after the raw commit (for example the database failing to read back) is thrown as `CaptureAfterSaveError` with the stored object's id. Errors thrown before or during the raw commit are thrown unchanged, and nothing was written.
- **Failure policy.** Each stage commits alone; there is no pipeline-wide transaction.
  - After an invalid extraction, the later stages still run.
  - After an unavailable, timed-out or unexpected reasoner error, later stages make no reasoner calls: houses get the fallback, and relations are `skipped`.
  - The engine never retries a reasoner call. The adapter retries malformed output at most once, and each CLI invocation is capped at one model attempt.
  - After the raw commit, enrichment failures are reported and never thrown.
- **Retry (§28).** `retryIncompleteCapture` re-runs extraction when no OBJECT_EXTRACTED exists, then stores houses when the object has no house rows. Relations are not re-run. It returns `in_progress` while a capture or retry of the same object is running in this process.

## Capture surface as implemented
- **`POST /api/capture`** (`app/api/capture/route.ts`) is an adapter over `captureThought`. It has no prompts, no reasoner calls and no persistence of its own; the tests assert it runs the pipeline once per request.
  1. Refuses with 403 `forbidden` unless the `Host` header is `localhost`, `127.0.0.1` or `[::1]` and any `Origin` header is a loopback page (`lib/utils/local-request.ts`). This blocks DNS-rebinding pages.
  2. Refuses with 415 `unsupported_media_type` unless the body is `application/json`. A cross-site page must then send a CORS preflight, which the route never grants.
  3. Refuses with 400 `invalid_request` for malformed JSON, a body that is not an object, or content that is not a non-empty string (the engine's validation). Nothing is stored.
  4. Calls `captureThought` with the app database and a fresh `ClaudeSubscriptionReasoner`, and waits for the whole pipeline.
  5. Returns 200 with the engine's `CaptureResult`: the four §26 fields `object`, `houseVector`, `concepts`, `relations`, plus `enrichment`. Partial enrichment (extraction failed, fallback houses, relation failure, Claude unavailable) is still 200.
  6. Returns 500 `capture_saved_incomplete` with `saved: true` and `objectId` for `CaptureAfterSaveError`: the thought is stored.
  7. Returns 500 `capture_not_saved` with `saved: false` for any other error (raw commit failed or the database could not be opened): nothing is stored.
  - Every error body is `{error, message, saved, objectId?}`. Failures are logged as one JSON line with operation, outcome, error name and object id, never content.
  - If the client disconnects, the handler keeps running: the raw thought stays stored and enrichment completes.
- **Response timing.** The response is sent once the pipeline finishes: typically 2 or 3 CLI calls. The worst case is bounded by the adapter: 6 CLI invocations at 120 s each plus kill grace, about 12.5 minutes, longer if other captures are queued ahead in the process-wide reasoner queue. The raw thought is stored before the first call.
- **Today page.** `TodayView` is a server component. It calls `connection()`, refuses non-loopback requests with a 404, and reads today's objects (local calendar day, newest first) with each object's dominant house from SQLite on every request.
- **ThoughtCard** shows time, title (when extracted), a content preview (CSS line clamp) and the dominant house as "n · Name" (§21 tie rule: lowest house). Operator buttons arrive in Phase 5.
- **CaptureBox** (client):
  - Cmd+Enter, Ctrl+Enter or the Capture button submits. Blank input is not sent. Auto-repeated keydowns are ignored.
  - While a request runs: the field is read-only and keeps its text, the button is disabled, further submits are ignored, and the status line reads "Capturing…".
  - The result is rendered (`flushSync`) before the in-flight guard is released, so a keypress queued behind the response sees the cleared field. Without this, the production build sent a second capture.
  - On a confirmed save (200, or 500 with `saved: true`): the field clears, the status summarises any enrichment gaps, and `router.refresh()` re-renders Today.
  - On `capture_not_saved`, `invalid_request`, `unsupported_media_type` or `forbidden`: the text stays and the status says nothing was saved.
  - On a network error or an unrecognised response: the text stays, the status says the capture could not be confirmed, and the page is not refreshed. A refresh that cannot reach the server makes Next 16 reload the page, which would discard the text.
  - Focus returns to the field (without scrolling) only if it was in the capture form or had fallen back to the page.
- **Status copy.** SPEC defines no capture copy.
  - Full success: "Captured."
  - Partial success: "Captured." followed by one sentence per gap: title and concepts not extracted; neutral default houses used; houses not classified; related thoughts not suggested.
- **Serving.** `npm run dev` and `npm run start` listen on 127.0.0.1 only (`-H 127.0.0.1`), so other machines on the network cannot reach the store or the subscription.

## Reasoner calls per capture
One call is one `Reasoner.runStructured`. With the real adapter, each call is at most 2 CLI invocations of one model attempt each. The capture route adds no calls: one request runs the pipeline once.

| Scenario | Calls | Max CLI invocations |
|---|---|---|
| Success, no candidates (for example the first capture) | extract, classify-houses = 2 | 4 |
| Success with candidates | extract, classify-houses, infer-relations = 3 | 6 |
| Extraction invalid | 3 (2 without candidates) | 6 |
| Extraction unavailable, timeout or unexpected error | extract = 1; fallback houses; relations skipped | 2 |
| Classification invalid | 3 (2 without candidates); fallback houses | 6 |
| Classification unavailable or timeout | 2; fallback houses; relations skipped | 4 |
| Relation inference invalid, unavailable or timeout | 3; no relations | 6 |
| Reasoner down for everything | 1 | 2 |
| House write failure | 2 or 3; houses `failed` | 6 |
| `retryIncompleteCapture` | 0 to 2 (extraction if incomplete, classification if no house rows and the reasoner is up); 0 when `in_progress` | 4 |

## Phase 3 delivered
- **Created, capture engine:**
  - `lib/engine/capture.ts`, `extract.ts`, `house-classifier.ts`, `relation-inference.ts` and `relevance.ts`
  - `lib/ai/prompts/extract.ts`, `classify-houses.ts` and `infer-relations.ts`
  - `lib/utils/math.ts`
- **Created, capture surface:**
  - `app/api/capture/route.ts`
  - `components/today/ThoughtStream.tsx` and `ThoughtCard.tsx`
  - `lib/utils/local-request.ts`
- **Created, tests:**
  - `tests/fixtures/capture-fixtures.ts` and `no-real-claude.setup.ts`
  - `tests/fixtures/e2e-server.mjs` and `tests/fixtures/e2e-bin/claude` (the fake CLI for acceptance tests)
  - `tests/unit/capture-contracts.test.ts`, `relevance.test.ts`, `no-real-claude.test.ts` and `local-request.test.ts`
  - `tests/integration/capture.test.ts`, `relation-candidates.test.ts`, `capture-route.test.ts` and `today-stream.test.ts`
  - `tests/acceptance/capture.spec.ts`
- **Modified, application:**
  - `components/today/CaptureBox.tsx`: wired to the route.
  - `components/today/TodayView.tsx`: reads today's objects.
  - `components/constellation/ConstellationPane.tsx`: the aria-label no longer claims nothing was captured today.
  - `app/globals.css`
- **Modified, library.** Each change only adds lines:
  - `lib/db/database.ts`: `getAppDatabase`.
  - `lib/db/repositories/concepts.ts`: `listObjectIdsSharingConcepts`.
  - `lib/db/repositories/objects.ts`: `listObjectIdsWithHouseScoreAtLeast`, `listRecentObjectIds` and `listObjectsCreatedBetween`.
  - `lib/domain/houses.ts`: `dominantHouse`.
  - `lib/utils/time.ts`: `localDayBounds`.
- **Modified, tooling and tests:**
  - `package.json`: scripts only; `dev` and `start` bind to 127.0.0.1.
  - `playwright.config.ts`: production and dev projects, each with its own server.
  - `vitest.config.mts`: setup file.
  - `tests/acceptance/today.spec.ts`: A3.
- **Modified, docs:** `BUILD_STATUS.md`, `OPEN_QUESTIONS.md` and `README.md` (loopback serving, the acceptance harness).

## Phase 3 acceptance gates (2026-09-17, final code)
| Gate | Result |
|------|--------|
| `npm test` | PASS: 18 files, 231 tests, with a guard that blocks any real `claude` process |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS: Next.js 16.3.5; `/` and `/api/capture` are rendered per request |
| `npm run test:e2e` | PASS: A1, A2 and A3 plus 13 capture tests, against both the production build and the dev server (31 passed; 1 production-only test skipped on dev). Every capture goes through the real route, engine and adapter; only the `claude` executable is a local fake. |
| Production smoke (`next start`, fake CLI) | PASS: capture returns the full result, JSON-only rule enforced, the thought renders on `/` |
| SPEC §32 capture, persistence and relation tests | PASS (`tests/integration/capture.test.ts`) |
| SPEC §34 static check | PASS; the API-key name appears only in the adapter's removal list |
| Mutation checks | Engine: all 41 injected regressions fail the suite. Capture surface: 18 of 19 fail it. The survivor removes `preventScroll` from the refocus, which no test covers. |
| Future-research terms in new code | none |
| `SPEC.md`, `CLAUDE.md`, `EXECUTION_PLAN.md`, migrations, schema, Phase 2 adapter files, `package-lock.json` | unchanged versus `pcf-v0.1-phase-2` |
| Research specification | unchanged since `a06fc27` |

## Phase 3 dependencies added
- none. `package.json` changed only in the `dev` and `start` scripts.

## Phase 3 interpretation decisions (non-blocking)
- **Metadata incomplete (§28).** An object is incomplete when it has no OBJECT_EXTRACTED event. There is no column for it.
- **Extraction fields.**
  - `unresolved` has no column. It is recorded in the OBJECT_EXTRACTED payload, and the object status stays `active`.
  - Extracted claims have `validFrom` and `validTo` null.
  - `lastActivatedAt` stays null at capture, and `activation` keeps the schema default 0.5.
- **Type priority.** The §14 type priority is encoded in the extraction prompt in its frozen order. It is not overridden in code.
- **Significant house overlap (§17.2).** Some house where both objects score >= 0.35, the §13 dominant-house threshold.
- **Recent objects (§17.3).** "Include up to two recent objects" adds them to the pool before ranking, so eight more relevant candidates can outrank them.
- **§19 details.**
  - G: a direct non-rejected relation takes precedence over a two-hop path, and the best direct relation counts.
  - F: uses feedback with `target_type` `"object"`, and `acted_on` has no §19 value so it is skipped.
  - T: uses creation timestamps only.
- **Content sent to the reasoner.** Candidate content is cut to 600 characters. The source thought is sent in full. System prompts are fixed text, and user content goes only in the prompt body.
- **Relation duplicates.** Rejected relations also count as existing, so a declined link is not proposed again.
- **Logging (§13 error log, §29).** Failures, fallbacks and skips are logged as one JSON line to stderr by default, with operation, object id, outcome, error kind and duration, and never content.
- **Test guard.** Tests block any process named `claude`, whether by name, by path, or as the first word of a shell command. The guard's own tests would fail with "not found" rather than reach a real CLI if the guard were missing.
- **Capture response (§26).** The route returns the engine's `CaptureResult`: the four §26 fields plus `enrichment`, which reports §28 "metadata incomplete" and the fallback. `houseVector` is null only when not even the fallback could be stored.
- **Response timing.** The route returns after the whole pipeline, as instructed. §25B's "clears only after raw content is safely persisted" holds because the field clears only after that response.
- **Capture button.** §25B names only the keyboard shortcut. A text-labelled Capture button was added for pointer users (§37 "buttons with text labels"). It is the same submit path.
- **Local-only serving.** §5 and §27 make PCF local and single-user. The app therefore listens on 127.0.0.1 and answers only loopback host names, and the capture route requires JSON. Phase 4-6 routes must apply `isLoopbackRequest` too.
- **Migrations on first use.** `getAppDatabase` applies pending migrations when the app first opens the database, using the existing runner. `npm run migrate` still works.
- **Today.** "Today" is the server's local calendar day; for this local app, that is the user's.
- **No retry control.** §28 "allow retry" exists in the engine (`retryIncompleteCapture`). No UI or route triggers it, since §26 defines none; see `OPEN_QUESTIONS.md`.
- **Acceptance harness.** `tests/fixtures/e2e-server.mjs` puts a fake `claude` first on PATH and refuses to start unless `claude` resolves to it. It also refuses on Windows, where the fake cannot be resolved. The fake refuses to run without `PCF_E2E_FAKE_CLAUDE=1`. Failure markers inside the captured text select extraction, house, relation or outage failures.
- **One production-only test.** The late-keypress test is skipped on the dev server, because React development builds render the cleared field before any other task can run.

## Phase 3 review
- **Five-lens review.** It covered data integrity, reasoner boundary, SPEC conformance, relations and test strength, with three skeptics per finding: 24 findings, 18 survived, all fixed.
  - Overlapping retries, or a retry during a running capture, could commit an extraction twice. Now an in-flight guard and in-transaction re-checks prevent it.
  - A failed fallback house write, or a candidate-selection database error, escaped `captureThought` after the raw commit. Both are now reported as `houses: "failed"` and `relations: "failed"`.
  - Objects left without house rows could never be repaired. Retry now fills them in.
  - The existing-relation check could never fire. It now covers the reverse direction for symmetric types.
  - The no-real-Claude guard test was not fail-safe and missed shell strings. Both are fixed.
  - Ranking components, outage call counts, partial-commit atomicity, the relation prompt boundary and the payload fields are now each pinned by tests.
- **Rejected by the skeptics (6).**
  - Blank claim fields stored verbatim.
  - Missing BUILD_STATUS decisions (written now).
  - Fallback vectors counting as house overlap.
  - Candidate-pool cost at 10k objects.
  - Direct-relation precedence over two-hop.
  - Further guard bypasses through env, fork or require.

## Capture surface review (2026-09-17)
- **Lenses.** Four: durability and error semantics, client behaviour, concurrency and security, test strength. Three skeptics checked each finding. Of 14 findings, 9 survived and all are fixed:
  1. **Refresh after an unconfirmed capture.** When the server could not be reached, `router.refresh()` made Next reload the page and discard the text the UI said was kept. Refresh now happens only after a confirmed save.
  2. **Guard released too early.** The in-flight guard was released before the cleared field rendered, so in the production build a keypress queued behind the response sent the thought again (reproduced: 2 POSTs). The result is now rendered first, and auto-repeat is ignored.
  3. **Refocus.** Focus returned to the field unconditionally and scrolled the page. It now returns only from the capture form, without scrolling.
  4. **LAN exposure.** `next dev` and `next start` listened on every interface, so LAN peers could capture, spend the subscription and read Today. Both now bind to 127.0.0.1.
  5. **DNS rebinding.** A rebinding page could capture and read Today. The route and the Today page now require a loopback host and origin.
  6. **Windows harness.** On Windows the harness PATH check would pass while the app started the real `claude.exe`. The harness now refuses to run on Windows.
  7. **Duplicate after a post-save failure.** The route test missed a retry that stored the thought twice. It now counts objects, events and pipeline runs.
  8. **Text kept during the request.** No test checked that the text stays until the save is confirmed. One does now.
  9. **Cmd and Ctrl.** Only one modifier was tested per platform. Both are now tested.
- **Rejected by the skeptics (5).**
  - SQLite `synchronous=NORMAL` durability on power loss: pre-existing and not required by SPEC.
  - No reachable retry control, raised twice: SPEC defines no surface for it (recorded as an open question).
  - Long-open requests: the approved v0.1 design.
  - Acceptance tests only against `next dev`: no current defect, though production is now tested too.
- **Found while verifying the fixes.** The late-keypress race exists only in production builds, so the acceptance suite now runs against both builds. Ordering of the Today list had no test; `today-stream.test.ts` now covers it.

## Deviations from SPEC.md
- None in behaviour.
- `lib/utils/local-request.ts` is one additive file that is not in the §7 tree. It holds the loopback check shared by the capture route and the Today page.
- Relation steps 12-14 and §19 were built in Phase 3 under the authorized phase-boundary resolution above.

## Blockers
- none. See `OPEN_QUESTIONS.md` for the non-blocking retry-surface question.

## Next action
Phase 3 is checkpointed. Wait for explicit approval before Phase 4 (MMR reranking, contextual constellation selection, deterministic layout and the SVG). Phase 4 must reuse the Phase 3 relevance, candidate and relation primitives, and its routes must apply the loopback check.

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

## Phase 2 deviations from SPEC.md
- none.

## Phase 2 blockers
- none

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
| 5 — Four operators | approved, tag `pcf-v0.1-phase-5` | npm test PASS (330), build PASS, e2e PASS (A1-A6), live preflight run, mutations 20/20 |
| 4 — Relevance + constellation | approved, tag `pcf-v0.1-phase-4` | npm test PASS (267), build PASS, e2e PASS (A1-A3, A5, A6) |
| 3 — Capture intelligence | approved, tag `pcf-v0.1-phase-3` | npm test PASS (231), build PASS, e2e PASS (A1-A3 + 13 capture tests, production and dev) |
| 6 — Cognitive return | not started | — |
| 7 — Product polish | not started | — |
