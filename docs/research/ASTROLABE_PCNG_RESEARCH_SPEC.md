# PCF ASTROLABE + PERSONAL COGNITIVE NEURAL GRAPH

> **FUTURE RESEARCH ONLY. THIS DOCUMENT DOES NOT AUTHORIZE IMPLEMENTATION.**
>
> The frozen PCF v0.1 build contract is `SPEC.md`. If anything in this document conflicts with it, `SPEC.md` wins.
> No PCNG, Astrolabe or PCF Dreaming machinery is authorized for v0.1.
> Nothing here permits adding embeddings, vector storage, neural networks, learned weights, plastic edges, activation engines, regime or prediction models, Dreaming, an Astrolabe runtime, agents, background workers, tables, migrations or dependencies to v0.1.

| Field | Value |
|---|---|
| Status | FUTURE RESEARCH — NOT IMPLEMENTATION AUTHORITY |
| Date | 2026-09-16 |
| Current implementation baseline | PCF v0.1 Phase 1 (accepted checkpoint `pcf-v0.1-phase-1`) |
| VEDA source | `/Users/christoler/Library/CloudStorage/Dropbox/VEDA_TO_PCF_FORENSIC_HANDOFF.md` (byte-identical copy at `/Users/christoler/Desktop/VEDA_TO_PCF_FORENSIC_HANDOFF.md`) |
| Frozen implementation authority | `SPEC.md` |
| Principle | Preserve the seam. Do not build the machinery. |

## Preservation preamble

This preamble was added when the specification was placed in the repository. The specification itself starts at **Research Specification v0.1** below. Its text is unchanged apart from the formatting listed under [Preservation notes](#preservation-notes).

### Authority order

For current PCF v0.1 implementation:

1. `SPEC.md`
2. `CLAUDE.md`
3. the current accepted phase checkpoint, recorded in `BUILD_STATUS.md`
4. `EXECUTION_PLAN.md`

For future research:

1. `docs/research/ASTROLABE_PCNG_RESEARCH_SPEC.md` (this document)
2. `VEDA_TO_PCF_FORENSIC_HANDOFF.md` (outside this repository; see [Source material](#source-material))
3. other future-state and research documents, currently `docs/FIELDS_AND_LENSES_ADDENDUM.md`, `docs/POST_V0.1_ROADMAP.md` and `docs/OBSIDIAN_ROAM_PLUGIN_RESEARCH.md`

Rules:

- If a future research document conflicts with the frozen v0.1 contract, v0.1 wins.
- This research specification does not authorize implementation. Work described here starts only if the user explicitly amends `SPEC.md` or authorizes a later version.
- For what VEDA actually built, measured, rejected or falsified, the VEDA handoff is the authoritative source. This document leads on proposed future PCF architecture, not on the history of VEDA.

### Architectural separation

```text
CURRENT PCF v0.1
=
symbolic / deterministic substrate

FUTURE PCNG
=
derived adaptive neural layer

ASTROLABE
=
relational + temporal transformation / policy layer

PCF DREAMING
=
future replay / consolidation / policy-improvement layer
```

The future adaptive layer must never become the sole repository of user memory. Canonical state remains user-owned and inspectable.

```text
MODEL != MEMORY
CANONICAL MEMORY != LEARNED NEURAL STATE
```

### VEDA inheritance principle

The forensic audit's conclusion is preserved here: VEDA's strongest transferable contribution is primarily its procedural and inference architecture, not literal astrological doctrine.

Research mechanisms to inherit:

- moving re-rooting and relative frames
- directed influence
- higher-order conjunction testing
- defeaters and cancellation
- support versus obstruction
- Promise × Timing × Trigger
- hierarchical temporal regime structure
- applicability and refusal
- null models
- per-item relation nulls
- FDR (false discovery rate) control
- novelty measures
- composition grammar
- provenance discipline
- the H/PE non-contamination firewall (source confidence kept apart from predictive evidence)
- structure-algebra discipline
- Inference Archaeology

Rejected lessons, preserved as warnings:

- Do not treat traditional constants as truths.
- Do not use birth or calendar clocks as personalized cognitive timing.
- Do not assume named yogas are predictive.
- Do not treat dispositor attractors as causes.
- Do not treat multiple projections as independent evidence.
- Do not use whole-history normalization for historical prediction.
- Do not loosen detectors until they produce results.
- Do not present uncalibrated scores as probabilities.
- Do not allow uncontrolled combinatorial conjecture generation.

Four kinds of statement appear in the specification, and they must stay distinct:

| Kind | Meaning | Where the specification marks it |
|---|---|---|
| Inherited from VEDA | A mechanism VEDA built or measured, carried over as computation | §4, §5, and statements introduced as "VEDA found", "VEDA already", "the report" (for example §9, §11, §14, §22.1, §27, §43, §57) |
| Rejected or falsified in VEDA | A construct VEDA tested and found redundant, leaky, uninformative or non-causal | §6, §12 (fixed schedule), §14 (whole-series leaks), §30 (dispositor attractors), §32 (n=1 confirmatory claims), §50 (shared clocks), §53 (privacy failure) |
| New PCF hypothesis | A proposal with no VEDA precedent that must be tested before use | §1, §7–§8, §18, §23–§29, §31, §33–§42, §45–§49, the "PCF adds" list in §57, §58–§61 |
| Future speculative mathematics | A candidate formula, not a validated result | every equation; the specification itself says so in §12, §18, §24, §25, §28 and §29, and every mechanism must pass §51, §52 and §60 |

A statement in one row must not be cited as if it belonged to another. In particular, no hypothesis or candidate formula here is an established result.

### Source verification

On 2026-09-16 the VEDA-attributed statements in this document were checked against the handoff, read-only, by three independent readers. Two further readers re-checked every statement not rated fully supported. Handoff references use its section numbers and line numbers.

Result: 40 statements checked, 30 supported, 10 partially supported, none unsupported or contradicted. The specification text below is unchanged; where it goes beyond the handoff, the table says how.

"Supported" means the handoff records or recommends the mechanism. It does not mean VEDA validated it as predictive. The handoff records several inherited mechanisms as inert, reporting-only or design-only in VEDA. These include directed aspects and defeaters (inert as deployed), the trigger factor (inert), Argala (reporting only), composition grammar (design only), and the dense-weak learner (never faithfully tested) (§3, §12, §17.5, §6.2).

Fully supported:

- **The inheritance principle and lists in this preamble.** The procedural/inference conclusion is at §2 L185, §17.11 L1329-1331 and §13. All seventeen inherited mechanisms are at §3, §12, §17.2, §17.4, §17.5 and §17.9. All nine rejected lessons are at §6.2, §13 and §17.10. The handoff never ranks any mechanism as the single "strongest".
- **§5, strongest transferable mechanisms.** The claim that re-rooting, directed influence, higher-order rules, defeaters, factorized timing and applicability are among the strongest transferable mechanisms is at §17.2 L1159-1177 and §12 L883-905. The re-rooting that holds up is the moving frame; the static natal frame was harmful as shipped (§3 L238-239).
- **§5 primitive table.** Every row except multi-frame representation maps to §12 and §17.5. Daśā nesting is rated only PLAUSIBLE, with fixed proportions rejected (§12 L901-902).
- **§6, not-inherited list.** All thirteen items are addressed at §13 items 1, 4, 5 and 11, and §17.10 items 1-5.
- **§14 and §15, look-ahead leaks.** The whole-series leak is at §6.2 F4-F5 L521-522 and §13 item 7.
- **§30, dispositor attractors falsified as causes.** See §3 L243, §12 L891 and §17.3 L1184.
- **§32, n = 1 confirmatory pathway closed.** See §2 L215, §7.7 L683 and §6.2 F50. JSM is a third-party design that VEDA formalised and audited (§7 L582).
- **§43, dense-weak effect destroyed by per-cell screening.** See §3 L275, §6.2 F20 L537 and App A §4.6. The evidence is synthetic only.
- **§50, a shared clock carries no personal information.** See §9.3 L774 and §17.2 item 11 L1176.
- **§53, private data in tracked files.** See §6.2 F-P1 L576 and §16 item 43.
- **§57, "VEDA already supplied" list and closing sentence.** See §17.9 L1287-1301, §17.7 and §17.11 L1331.

Partially supported:

| Specification statement | What the handoff supports | What goes beyond the handoff |
|---|---|---|
| §3: the H/PE firewall is "VEDA's strongest methodological inheritance" | Rated STRONG and listed among key discoveries and direct inheritances (§12 L911, §17.2 L1171, §17.9 L1290). | The handoff does not rank it strongest. The "most transferable asset" label refers to a whole method bundle (App D L3284), and Inference Archaeology is called the discipline behind the rest (§12 L919). The firewall came from the third-party JSM v0.2 specification (App B L2174) and was enforced only in the hashed prediction path (§7.3 L607-615, §6.2 F52). |
| §5 table, multi-frame representation; §9: "VEDA showed that multiple projections of the same underlying signal can create false apparent information" | Divisional charts are a redundant relabelling: 9 of 16 add no resolution (§3 L263). Derived views and restatements carry no new evidence (§3 L296, §6.2 F30-F32, §17.9 item 6). | The quoted sentence does not appear. The handoff frames the varga lesson as resolution and learning harm, not as a projection principle, and lists redundancy-as-error-correction as an open question (§17.12 Q8 L1341). |
| §6: fixed partitions were "redundant, correlated, unstable under relabelling, or no better than controls" | Redundant (vargas) and no better than rotated controls (12/27/108 boundaries) (§3 L236, L259, L263; §13 item 4). | "Unstable under relabelling" is recorded for dispositor attractors, and "correlated" for shadbala views, neither of which is a partition. The handoff also records that discretisation itself is load-bearing (App C L2863). |
| §11: clock disagreement treated "as information rather than something to collapse" | Many time systems coexist, are deliberately not averaged, and disagreement is reported (§9.2 L758-766, §17.6 L1246). | Disagreement is not described as information, and readout does collapse: forecasts reduce to a per-domain scalar, and activation takes the maximum source plus a corroboration bonus (App C L2755, L2999-3007). |
| §13: required promise-only / timing-only / trigger-only / pairwise ablations | The factorised structure is existing fact and load-bearing, tested with a collapsed `no_factorization` arm (§9.3 L768-775, App A §4.12). | The single-factor and pairwise ablation grid is not described in the handoff; it is a new PCF requirement. |
| §22.1: "VEDA's measured `jointbits` novelty" | `jointbits` exists as a conditional-entropy novelty and redundancy measure (§4.2 M4 L339, §11.1 L846). | It conditions on earlier-ordered indicators across a population sample, not on personal history, was run only as an identity check, and lacks a personal baseline (§11.2 L863-867). Conditioning on personal history is a new PCF adaptation. |
| §27: the weave "demonstrated directed metaphor extraction and the importance of keeping metaphor, association and attested relationships distinct" | The directed tenor-to-vehicle miner is live and measured, with precision falling from 0.93 to 0.81 on a larger corpus (§11.1 L854, §6.2 F29). | The separate relation lanes come from the Reader visual-semantics research, not the weave, and were designed but not built (App D L3205, App F L4316, L4346). |
| §57: "PCF adds" list | Most items are named as new relative to VEDA (§17.11 L1317-1331, §10.2, §17.6-§17.7). | Metaplasticity and homeostasis appear only as absent from VEDA (§14 L1018). Intervention policy learning, PCF Dreaming and recursive policy improvement do not appear in the handoff; they are new hypotheses from this specification. |

The seven session-citation markers do not map reliably onto handoff line numbers. One (§32) happens to fall on the matching text; three others (§11, §27, §57) do not. Cite the handoff sections above instead.

### Source material

- **VEDA forensic handoff.** `/Users/christoler/Library/CloudStorage/Dropbox/VEDA_TO_PCF_FORENSIC_HANDOFF.md`, 704,099 bytes, 4,458 lines, SHA-256 `d30e017ab0261d9d7c72baf68c8a858146b2c39b268b4b88127e3cbc26ab73a7`. A byte-identical copy is at `/Users/christoler/Desktop/VEDA_TO_PCF_FORENSIC_HANDOFF.md`. It is the read-only audit of the VEDA / KALA / JSM research program, dated 2026-09-16. It is deliberately not copied into this repository: it lives outside the repo, it describes a real person's research, and it was written under its own privacy redaction rules.
- **Session citations.** Seven statements in the specification carry markers such as `[session citation: turn11file7 L341-L355]`. They are citation markers from the research session that produced this specification, referring to files uploaded in that session. They cannot be resolved from this repository and are kept only for traceability. Use the handoff section references under [Source verification](#source-verification) instead.

### Preservation notes

The specification below was pasted by Christopher on 2026-09-16. Only these formatting changes were made:

- The title moved to the top of this file. "Research Specification v0.1" became a bold subtitle line.
- Headings moved down one level so the file has a single top-level title: numbered sections are level 2, their subsections level 3, and so on. The four named principles that were top-level headings inside sections (Inference Archaeology, Projection Non-Inflation, Future Rewrite Test, Novel Cognitive Yield — NCY) are level 3 headings within their sections.
- LaTeX delimiters `\[ … \]` and `\( … \)` became `$$ … $$` and `$ … $`, which GitHub and Obsidian render. The mathematics inside is unchanged.
- The seven chat citation markers, which had lost their separators in transit, are written as `[session citation: <id> <lines>]`.

Reversing these four changes reproduces the pasted text byte for byte; this was checked mechanically when the file was created.

---

The preserved specification begins here.

**Research Specification v0.1**

**Status:** CANONICAL FUTURE-STATE RESEARCH SPECIFICATION  
**Implementation authority:** NONE  
**Current implementation baseline:** Frozen PCF Phase 1  
**Primary source:** `VEDA_TO_PCF_FORENSIC_HANDOFF.md`  
**Purpose:** Define the mathematical research architecture by which mature PCF may evolve from a symbolic cognitive graph into a persistent, plastic, neuro-symbolic Personal Cognitive Neural Graph governed by an adaptive Astrolabe.

---

## 0. ABSOLUTE SCOPE RULE

This document does **not** authorize changes to:

- `SPEC.md`
- the Phase 1 SQLite schema
- CognitiveObject
- HouseVector
- current Relation semantics
- Claim
- Events
- Operator Runs
- Feedback
- the Phase 2–7 execution plan

The current PCF v0.1 implementation remains the experimental substrate.

Everything below is future research.

The governing principle is:

> **Preserve the seam. Do not build the machinery until the simpler system demonstrates the need for it.**

---

## 1. RESEARCH THESIS

PCF investigates whether a person's accumulated intellectual life can become a persistent computational substrate that does more than remember.

The mature target is:

> **A persistent, user-owned, interpretable neuro-symbolic cognitive field whose nodes remain human-legible, whose relations and representations reorganize through experience, whose temporal dynamics model cognitive momentum, and whose Astrolabe learns when and how to retrieve, connect, challenge, juxtapose, resurface, explore, predict, or abstain in order to increase useful discovery.**

Formally, define the Personal Cognitive Neural Graph at time $t$ as:

$$
\mathcal{N}_t
=
(V_t,E_t,W_t,A_t,Z_t,\Pi_t,\mathcal{C}_t,\mathcal{R}_t)
$$

where:

- $V_t$: persistent CognitiveObjects
- $E_t$: symbolic and learned relational topology
- $W_t$: learned directed influence weights
- $A_t$: activation state
- $Z_t$: learned personal representations
- $\Pi_t$: plasticity parameters
- $\mathcal{C}_t$: higher-order cognitive circuits
- $\mathcal{R}_t$: temporal regime state

The graph itself evolves:

$$
\mathcal{N}_{t+1}
=
\operatorname{Learn}
(
\mathcal{N}_t,
Experience_t,
Outcome_t
)
$$

but **canonical memory remains outside learned weights**.

A model may be replaced.

PCF state must survive.

---

## 2. THE FUNDAMENTAL SEPARATION

PCF shall distinguish:

### 2.1 Explicit memory

Human-readable canonical state:

$$
M_t^{explicit}
=
\{
Objects,
Claims,
Relations,
Sources,
Events,
Feedback
\}_{\le t}
$$

This is user-owned, inspectable and portable.

### 2.2 Implicit memory

Learned organization:

$$
M_t^{implicit}
=
\{
W_t,
Z_t,
A_t,
\Pi_t,
Policy_t,
Circuits_t
\}
$$

This may be rebuilt.

Therefore:

$$
\boxed{
CanonicalMemory \neq NeuralMemory
}
$$

and:

$$
\boxed{
Model \neq Memory
}
$$

No learned model is allowed to become the sole repository of a user's intellectual history.

---

## 3. THE EPISTEMIC FIREWALL

VEDA's strongest methodological inheritance is preserved.

PCF shall maintain separate states for:

$$
Observation
\neq
DerivedStructure
\neq
Interpretation
\neq
MeasuredAssociation
\neq
CalibratedPrediction
\neq
CausalMechanism
$$

These transitions may never happen silently.

A second firewall separates:

$$
H = Source/ProvenanceConfidence
$$

from:

$$
PE = PredictiveEvidence
$$

Thus:

$$
\frac{\partial Prediction}{\partial H}=0
$$

unless source quality has independently demonstrated predictive relevance under a declared experiment.

In ordinary operation:

> A respected source is not automatically predictive.

> A strong learned association is not automatically factual.

> A neural edge is not automatically causal.

> A metaphor is not evidence.

> A prediction is not a mechanism.

Future implementations must enforce these distinctions structurally, not merely in prompts.

---

## 4. VEDA INHERITANCE POLICY

The Vedic/Jyotish system is treated as a source of **candidate computational primitives**.

The ontology is not assumed to be true.

The governing method is:

### Inference Archaeology

For every inherited construct:

1. identify its computational structure;
2. remove metaphysical assumptions;
3. identify arbitrary constants;
4. construct the simplest conventional baseline;
5. test the translated mechanism;
6. preserve failures;
7. keep only the mechanism if it earns its place.

The historical system supplies:

$$
Hypotheses
$$

not:

$$
Authority
$$

---

## 5. PRIMITIVES TO INHERIT

These mechanisms survive into the research architecture.

| Jyotish/VEDA primitive | PCF interpretation |
|---|---|
| Lagna | Dynamic cognitive reference frame |
| Temporary Lagna / re-rooting | Recompute meaning relative to another anchor |
| Dṛṣṭi | Directed conditional influence |
| Yuti | Coactivation |
| Yoga | Higher-order learned circuit |
| Bhanga | Defeater / cancellation / valence reversal |
| Argala | Support vs obstruction; contested state |
| Daśā architecture | Hierarchical learned temporal regimes |
| Promise × Timing × Trigger | Factorized transition architecture |
| Aṣṭakavarga principle | Dense-weak ensemble with explicit null |
| Sandhi principle | Boundary uncertainty |
| Applicability/refusal | Determine when a model should not infer |
| Multi-frame representation | Parallel projections without evidence duplication |
| Provenance tiers | Attributed meaning with source status |
| Composition grammar | derive / modify / blend / juxtapose |
| Inference Archaeology | Mandatory borrowing discipline |

The report specifically found dynamic re-rooting, directed influence, higher-order rules, defeaters, factorized timing and refusal/applicability to be among the strongest transferable mechanisms. [session citation: turn11file7 L341-L355]

---

## 6. PRIMITIVES EXPLICITLY NOT INHERITED AS TRUTH

PCF must not encode these as factual priors:

- fixed Vimshottari timing proportions;
- traditional astrological predictions;
- named yogas as predictive rules;
- natal house/sign interpretations;
- dasha-phala;
- gochara valuation;
- fixed planetary aspect weights;
- shadbala components as independent evidence;
- dispositor cycles as causes;
- combustion as a redundancy mechanism;
- fixed 27/108-fold partitions as privileged neural states;
- D60-like precision unsupported by input precision;
- birth-keyed or calendar-keyed clocks as personalized cognitive timing.

VEDA found multiple examples where fixed partitions were redundant, correlated, unstable under relabelling, or no better than controls. [session citation: turn11file0 L21-L56]

#### Special status of Houses

PCF v0.1's twelve Houses remain a **designed semantic ontology**.

They are not claimed to derive predictive validity from astrology.

#### Special status of Grahas

The four v0.1 operators remain product abstractions.

Nine fixed operator types must not become mandatory because Jyotish has nine grahas.

Future operator specialization must be empirically earned.

#### Special status of Rāśis and Nakshatras

Rāśi-as-processing-mode and Nakshatra-as-microstate remain **research hypotheses only**.

Continuous learned representations are the baseline they must beat.

---

## 7. CANONICAL PHASE-1 STATE

The frozen Phase 1 implementation is the symbolic skeleton.

Let:

$$
\mathcal{C}_t =
(O_t,H_t,K_t,R_t,Q_t,E_{\le t},F_{\le t})
$$

where:

- $O_t$: CognitiveObjects
- $H_t$: 12-dimensional HouseVectors
- $K_t$: Concepts
- $R_t$: canonical typed Relations
- $Q_t$: Claims
- $E_{\le t}$: append-only Events
- $F_{\le t}$: Feedback history

No future neural layer may overwrite this state.

Derived neural state sits **above** it:

$$
\mathcal{C}_t
\rightarrow
\mathcal{N}_t
$$

not:

$$
\mathcal{N}_t
\rightarrow
rewrite(\mathcal{C}_t)
$$

Machine inference proposes.

Canonical state changes only through explicit sanctioned transitions.

---

## 8. THE ASTROLABE

The Astrolabe is not the neural graph.

It is the **contextual transformation and policy layer** operating over the graph.

Define:

$$
\mathfrak{A}_t
=
\Phi(
\mathcal{C}_{\le t},
\mathcal{N}_t,
L_t,
Q_t,
G_t
)
$$

where:

- $\mathcal{C}_{\le t}$: canonical history available at time $t$
- $\mathcal{N}_t$: learned PCNG state
- $L_t$: Cognitive Lagna/current anchor
- $Q_t$: current question or intent
- $G_t$: external/global context

The Astrolabe produces:

$$
\{
Field_t,
Regime_t,
Momentum_t,
ApplicableMethods_t,
CandidateInterventions_t,
Predictions_t,
ProvenanceTrace_t
\}
$$

The Astrolabe never silently mutates canonical memory.

Its responsibilities are:

```text
LOCATE
Where am I cognitively?

RE-ROOT
Relative to what am I examining the field?

ORIENT
Which domains, relationships and regimes matter?

DIAGNOSE
Which inference methods are valid here?

NAVIGATE
Which cognitive intervention should be attempted?

EXPLAIN
Why did this appear?

LEARN
Did the intervention ultimately help?
```

---

## 9. THE ASTROLABE'S MULTI-DIAL LAW

VEDA showed that multiple projections of the same underlying signal can create false apparent information.

PCF therefore adopts:

### Projection Non-Inflation

If one canonical observation $x$ is expressed through $k$ projections:

$$
P_1(x),P_2(x),...,P_k(x)
$$

then:

$$
Evidence(
P_1(x),...,P_k(x)
)
\le
Evidence(x)
$$

unless the projections contain independently measured information.

Fields, Lenses, House coordinates, embeddings, graph positions and other projections **do not create extra evidence merely by existing**.

This is the computational lesson PCF inherits from VEDA's multi-resolution failures.

---

## 10. RE-ROOTING — COGNITIVE LAGNA

The most important direct structural inheritance is dynamic reference-frame transformation.

Let current Cognitive Lagna be:

$$
L_t = v_\ell
$$

for anchor object $v_\ell$.

For every candidate object $v_i$, construct a relative representation:

$$
\Psi_\ell(i)
=
[
H_i,\;
H_i-H_\ell,\;
H_i\odot H_\ell,\;
d_G(i,\ell),\;
PathTypes(i,\ell),\;
ConceptOverlap(i,\ell),\;
TemporalDistance(i,\ell)
]
$$

where:

- $H_i$: HouseVector
- $d_G$: graph distance
- $PathTypes$: typed relational paths
- $ConceptOverlap$: semantic overlap
- $TemporalDistance$: time separation

A re-rooted Field is:

$$
Field(L_t)
=
Rank_{\ell}
(V_t)
$$

The underlying graph is unchanged.

Re-rooting changes:

$$
Perspective
$$

not:

$$
Evidence
$$

Therefore:

$$
Evidence(v_i \mid L_a)
=
Evidence(v_i \mid L_b)
$$

even though relevance may change.

### Multi-origin re-rooting

Future PCF may construct several Fields simultaneously:

$$
Field(L_1),
Field(L_2),
...
Field(L_k)
$$

Examples:

- current thought;
- active project;
- unresolved question;
- older life experience;
- conflicting belief.

These remain separate views unless a comparison operator explicitly combines them.

They are never silently averaged.

---

## 11. TEMPORAL ARCHITECTURE

Time is not a metadata field.

It is a primary coordinate.

PCF shall eventually maintain at least four temporal representations.

### 11.1 Chronological time

What happened when?

$$
t
$$

The append-only event stream is authoritative.

### 11.2 Activation time

What is cognitively active now?

$$
A_t
$$

Something old may have high activation.

Something recent may have almost none.

### 11.3 Momentum time

What is changing?

$$
M_t
$$

### 11.4 Regime time

What broader cognitive mode currently dominates?

$$
R_t
$$

These clocks may disagree.

PCF must **report disagreement rather than averaging them away**.

VEDA already maintained several distinct time systems and explicitly treated clock disagreement as information rather than something to collapse. [session citation: turn11file2 L127-L148]

---

## 12. LEARNED TEMPORAL REGIMES

The structural lesson from Daśā is nested temporal gating.

The fixed astrological schedule is rejected.

Instead PCF learns hierarchical regimes.

Define:

$$
R_t =
(
R_t^{macro},
R_t^{meso},
R_t^{micro}
)
$$

Possible empirically discovered regimes might include:

- exploration;
- convergence;
- verification;
- execution;
- incubation;
- transformation.

These names are descriptions after discovery, not hardcoded states.

A candidate future model is a hierarchical semi-Markov process:

$$
P(R_t^k
\mid
R_{t-1}^k,
R_t^{k-1},
X_{\le t})
$$

with duration:

$$
D_k \sim P(D\mid R^k)
$$

learned from actual cognitive history.

No traditional period length is privileged.

A regime gates processes:

$$
g_m(t)
=
P(
method=m
\text{ useful}
\mid
R_t,X_t
)
$$

Thus the same thought can call for different interventions under different cognitive regimes.

---

## 13. PROMISE × TIMING × TRIGGER

This is adopted as a core predictive interface.

The symbol “×” represents **conditional conjunction**, not a mandated arithmetic product.

For target transition $Y$:

### Promise \(P_t\)

What latent structure already exists?

Examples:

- unresolved cluster;
- dense bridge potential;
- repeated metaphor;
- mature idea;
- latent contradiction;
- historically productive operator pathway.

### Timing \(T_t\)

Is the current cognitive regime conducive to the transition?

Examples:

- exploration;
- execution;
- sustained H5/H9 activation;
- project convergence;
- declining novelty.

### Trigger \(G_t\)

What changed now?

Examples:

- new conversation;
- source;
- experience;
- contradiction;
- external event;
- returned memory.

A baseline factorized model is:

$$
\operatorname{logit}
P(Y_{t+\Delta}=1)
=
\beta_0
+
f_P(P_t)
+
f_T(T_t)
+
f_G(G_t)
$$

Controlled interactions may later be introduced:

$$
+
f_{PT}(P_t,T_t)
+
f_{PG}(P_t,G_t)
+
f_{TG}(T_t,G_t)
+
f_{PTG}(P_t,T_t,G_t)
$$

only after simpler models are beaten out of sample.

#### Required ablations

Every predictive experiment must compare:

```text
Promise only
Timing only
Trigger only
Promise + Timing
Promise + Trigger
Timing + Trigger
Full P × T × G
```

This determines what actually contributes.

---

## 14. TRIGGER CALCULATION

A trigger must be measured against the user's **past-only personal baseline**.

For feature $x_t$:

$$
Trigger_t
=
\frac{
x_t-\operatorname{median}(x_{<t})
}{
RobustScale(x_{<t})+\epsilon
}
$$

No centered window.

No whole-history normalization.

No future observation may affect an earlier trigger value.

This is mandatory because VEDA discovered multiple look-ahead leaks from whole-series transformations.

---

## 15. CAUSAL-TIME INVARIANT

Every temporal feature must satisfy:

### Future Rewrite Test

Take historical cutoff $t$.

Compute:

$$
Feature_{\le t}
$$

Then arbitrarily rewrite all observations after $t$.

Recompute.

Required:

$$
Feature_{\le t}^{original}
=
Feature_{\le t}^{rewrittenFuture}
$$

within declared numerical tolerance.

Failure means leakage.

No predictive research proceeds until the property holds.

---

## 16. APPLICABILITY — THE RIGHT TO REFUSE

PCF must learn not only:

> What should I infer?

but:

> **Should I infer at all?**

Every advanced method $m$ receives an applicability vector:

$$
D_m(t)
=
[
Support,
N_{eff},
OOD,
Calibration,
Stability,
NullPower,
InputQuality
]
$$

The first implementation should use a **fail-closed gate**, not a compensating weighted score.

$$
Applicable_m(t)
=
\prod_k
\mathbb{1}[D_{mk}(t)\in Valid_k]
$$

If any required condition fails:

$$
Output
=
INSUFFICIENT\_INFORMATION
$$

or:

$$
ABSTAIN
$$

No threshold may be relaxed because the model otherwise refuses too often.

The refusal rate is itself an evaluation metric.

---

## 17. DIRECTED INFLUENCE — DṚṢṬI AS COMPUTATION

PCF distinguishes:

$$
CanonicalRelation_{ij}
$$

from:

$$
LearnedInfluence_{i\rightarrow j}
$$

from:

$$
RelationConfidence_{ij}
$$

from:

$$
Utility_{ij}
$$

They may correlate.

They are not the same variable.

A future learned directed influence weight is:

$$
w_{i\rightarrow j}(t)
\in[-1,1]
$$

Positive:

> activation of $i$ tends to increase future activation/relevance of $j$.

Negative:

> activation of $i$ tends to suppress future activation/relevance of $j$.

Direction must be estimated independently:

$$
w_{i\rightarrow j}
\neq
w_{j\rightarrow i}
$$

by default.

Association alone cannot be labeled causal.

The `causal` status requires intervention, randomization, a defensible natural experiment, or another explicitly declared causal identification strategy.

---

## 18. ACTIVATION DYNAMICS

Each CognitiveObject receives future derived activation:

$$
a_i(t)\in[0,1]
$$

A candidate continuous-time-compatible update is:

$$
a_i(t+\Delta t)
=
e^{-\Delta t/\tau_i}a_i(t)
+
(1-e^{-\Delta t/\tau_i})
\sigma
\left[
b_i
+
x_i(t)
+
f_i(L_t)
+
\kappa
\sum_j
\bar w_{j\rightarrow i}(t)a_j(t)
+
c_i(t)
\right]
$$

where:

- $\tau_i$: activation decay time constant
- $b_i$: baseline excitability
- $x_i(t)$: direct external/capture stimulation
- $f_i(L_t)$: focus/Lagna relevance
- $\bar w$: stability-normalized influence weights
- $c_i(t)$: higher-order circuit input
- $\sigma$: bounded activation function

The graph must be constrained so recurrent propagation cannot diverge.

Possible controls include:

$$
\rho(\kappa \bar W)<1
$$

or equivalent bounded normalization.

Activation is derived state.

It never alters the original object content.

---

## 19. HIGHER-ORDER CIRCUITS — YOGA WITHOUT DOGMA

Pairwise edges cannot express every meaningful interaction.

A future circuit is a hyperedge:

$$
C=
\{v_1,v_2,...,v_k\}
$$

or an operator sequence:

$$
O_1\rightarrow O_2\rightarrow...\rightarrow O_k
$$

A circuit may be promoted only when its joint behavior exceeds a model containing its lower-order components.

Define held-out synergy:

$$
Synergy(C)
=
LL_{test}(M_{base+C})
-
LL_{test}(M_{base})
$$

where $M_{base}$ already contains relevant pairwise components.

Promotion requires:

- adequate support;
- positive held-out synergy;
- mine/confirm separation;
- multiple-testing correction;
- stability across resampling;
- no future leakage.

This is the PCF analogue of a learned yoga.

Traditional named yogas are not imported as priors.

### Example future learned circuit

```text
anomaly detected
      ↓
Mercury-like analogy
      ↓
Jupiter-like expansion
      ↓
Saturn-like falsification
      ↓
Mars-like experiment
```

If such a sequence repeatedly produces useful outcomes, it becomes a learned **Discovery Circuit**.

The name describes observed function.

It does not grant authority.

---

## 20. DEFEATERS — BHANGA

PCF requires explicit exception machinery.

A candidate rule $r$:

$$
A\rightarrow B
$$

may have defeaters:

$$
D_1,D_2,...,D_n
$$

Defeaters have typed effects:

```text
CANCEL
ATTENUATE
REVERSE
SCOPE_LIMIT
TEMPORAL_EXPIRE
```

For cancelling defeaters:

$$
r_{eff}
=
r
\prod_j(1-d_j)
$$

For a valence reversal:

$$
sign(r_{eff})
=
-sign(r)
$$

when the reversal condition is active and sufficiently supported.

No rule may silently swallow its exceptions.

The explanation must state:

```text
Rule fired.
Defeater present.
Result attenuated / cancelled / reversed.
```

---

## 21. ARGALA — SUPPORT, OBSTRUCTION AND CONTESTED STATE

A net score can hide important structure.

Therefore PCF preserves:

$$
Support=S
$$

and:

$$
Obstruction=O
$$

separately.

Net:

$$
N=S-O
$$

does not replace them.

Two states may have identical $N=0$:

```text
S = 0, O = 0
QUIET
```

versus:

```text
S = .9, O = .9
CONTESTED
```

These must never be represented identically.

`CONTESTED` becomes a first-class cognitive state.

Thresholds for contestedness are empirical research parameters, not inherited Jyotish constants.

---

## 22. NOVELTY

PCF shall not use one undifferentiated novelty number.

Novelty is a vector.

### 22.1 Personal content novelty

How much information is not predictable from prior personal concepts?

$$
N_C(x)
=
\frac{
H(x\mid History)
}{
H(x)
}
$$

This inherits the logic of VEDA's measured `jointbits` novelty.

### 22.2 Relational novelty

Are familiar concepts connected in an unexpectedly strong new way?

A baseline:

$$
N_R(i,j)
=
\log_2
\frac{
LB[P(j\mid i)]
}{
P(j)
}
$$

where `LB` is a conservative lower bound.

### 22.3 Structural novelty

Does the new motif exceed a topology-preserving null?

$$
N_S
=
ObservedStructure
-
ExpectedStructure_{null}
$$

### 22.4 Metaphorical novelty

Does a structurally strong mapping bridge semantically distant domains?

### 22.5 World novelty

Has the idea already appeared in external literature/public knowledge?

This requires external evidence and must remain separate from personal novelty.

PCF must never claim world novelty from personal memory alone.

---

## 23. NULL-GATED SYNAPTOGENESIS

This is one of the central PCNG research hypotheses.

An LLM may propose a relationship.

That does **not** make it a durable neural edge.

Candidate:

$$
e_{ij}^{candidate}
$$

First compute its expected co-occurrence under an appropriate personal null.

For windows $d$:

$$
\lambda_{ij}
=
\sum_d
p_{id}p_{jd}
$$

Observed coactivation:

$$
c_{ij}
$$

Then:

$$
p_{ij}
=
P(
Poisson(\lambda_{ij})\ge c_{ij}
)
$$

or a better validated null appropriate to the event process.

Apply multiple-testing control across simultaneously proposed relationships.

Only surviving edges may be promoted.

Potential lifecycle:

```text
CANDIDATE
   ↓
PROVISIONAL
   ↓
CONSOLIDATED
   ↓
DORMANT
   ↓
PRUNED
```

A canonical user-accepted Relation is never deleted merely because a learned neural edge decays.

#### Promotion dimensions remain separate

An edge has at least:

```text
existence/confidence
influence weight
personal usefulness
provenance
plasticity
```

These must never collapse into one scalar.

---

## 24. SYNAPTIC PLASTICITY

Once an edge passes structural admission, its learned influence may change.

Define an eligibility trace:

$$
e_{ij}(t)
=
\operatorname{Trace}
(
a_i,
a_j,
temporalOrder
)
$$

A candidate three-factor update is:

$$
\Delta w_{ij}
=
\eta_{ij}(t)
\,
e_{ij}(t)
\,
\delta_t
-
\lambda_{ij}(t)w_{ij}(t)
$$

where:

- $\eta$: plasticity/learning rate
- $e$: coactivation or sequential eligibility
- $\delta$: downstream utility/error signal
- $\lambda$: decay

Bound:

$$
w_{ij}\in[-1,1]
$$

This is a research equation, not an implementation requirement.

The important architecture is:

> repeated useful pathways strengthen;

> repeatedly useless pathways weaken;

> unsupported learned pathways may disappear;

> canonical memories do not.

---

## 25. METAPLASTICITY

PCF should eventually learn **how much it should learn**.

Let:

$$
\eta_{ij}(t)
=
\eta_{max}
\,
U_{ij}(t)
\,
N_t
\,
(1-C_{ij}(t))
$$

conceptually, where:

- $U$: uncertainty
- $N$: novelty
- $C$: consolidation/stability

High uncertainty + meaningful novelty:

$$
\eta\uparrow
$$

Stable repeatedly confirmed structure:

$$
\eta\downarrow
$$

This protects the system from catastrophic personality drift.

Specific functional forms must be compared experimentally.

No formula here is privileged.

---

## 26. HOMEOSTASIS

Pure personalization tends toward intellectual monoculture.

PCF therefore requires homeostatic constraints.

Examples:

$$
\sum_j |w_{j\rightarrow i}|
\le B_i
$$

and activation-density targets preventing every node from remaining highly active.

The policy objective must penalize:

```text
redundancy
echo-chamber behavior
over-specialization
cognitive overload
excessive interruption
repetition
```

An area dominating recent attention should eventually increase the exploration probability of neglected-but-relevant regions.

PCF optimizes cognitive usefulness.

It must not optimize engagement time.

---

## 27. METAPHOR AS STRUCTURAL TRANSFER

Life experience must eventually become more than text.

For object or experience $x$, construct an optional relational frame:

$$
Frame(x)
=
(
Actors,
Goals,
Constraints,
Relations,
Transitions,
Actions,
Outcomes
)
$$

For tenor $T$ and vehicle $V$, search for a partial mapping:

$$
\pi:
Frame(T)\rightarrow Frame(V)
$$

maximizing structural correspondence.

A metaphor candidate receives a vector:

$$
M(T,V)
=
[
StructuralFit,
SurfaceDistance,
Grounding,
Tension,
Novelty,
Utility
]
$$

High-quality metaphor requires:

```text
strong structural fit
+
enough domain distance to add something
+
clear mapping
+
no fabricated factual support
```

Metaphor remains a separate relation lane.

It does not increase evidentiary confidence in either object.

The VEDA weave research already demonstrated directed metaphor extraction and the importance of keeping metaphor, association and attested relationships distinct. [session citation: turn10file8 L220-L231]

---

## 28. CONSTRAINT TENSION

PCF adopts as a research hypothesis:

> **Useful novelty often appears where two structures resist trivial combination but admit a coherent higher-order reconciliation.**

Define rough tension:

$$
Tension(A,B)
=
(1-Agreement(A,B))
\,
\frac{
\min(|w_A|,|w_B|)
}{
\max(|w_A|,|w_B|)+\epsilon
}
$$

Low tension:

> redundant agreement.

Extreme unresolved tension:

> contradiction or nonsense.

Intermediate resolvable tension:

> potential creative synthesis.

Therefore creativity should not simply maximize semantic distance.

The target is:

$$
StructuredSurprise
$$

not:

$$
Randomness
$$

---

## 29. MOMENTUM

A static graph answers:

> What is connected?

Momentum answers:

> What is changing?

Let aggregate cognitive state be:

$$
X_t
=
[
HouseActivation,
ConceptActivation,
ObjectActivation,
OperatorUse,
BeliefState,
ProjectState,
Unresolvedness,
NetworkTopology
]
$$

Because events arrive irregularly, define:

$$
\kappa_t
=
1-e^{-\Delta t/\tau}
$$

Momentum:

$$
M_t^{(\tau)}
=
(1-\kappa_t)M_{t-1}^{(\tau)}
+
\kappa_t
\frac{
X_t-X_{t-1}
}{
\Delta t
}
$$

Acceleration:

$$
Q_t^{(\tau)}
=
(1-\kappa_t)Q_{t-1}^{(\tau)}
+
\kappa_t
\frac{
M_t-M_{t-1}
}{
\Delta t
}
$$

PCF should maintain multiple timescales:

$$
\tau_1,\tau_2,...,\tau_k
$$

rather than choosing one universal temporal window.

Timescales must eventually be learned or justified by validation.

---

## 30. COGNITIVE ATTRACTORS

Repeated trajectories may produce stable regions in cognitive state space.

An attractor is not declared because of a Jyotish dispositor rule.

It is learned from actual state dynamics.

Possible evidence:

$$
X_t
\rightarrow
X_{t+1}
\rightarrow
...
\rightarrow
\mathcal{A}
$$

repeatedly from multiple starting points.

Candidate uses:

- persistent research themes;
- recurring unresolved tensions;
- recurring creative states;
- recurring failure loops;
- repeatedly productive cognitive circuits.

Attractor ≠ cause.

VEDA falsified dispositor-attractor interpretation as root-cause attribution; PCF retains only the structural idea.

---

## 31. TRAJECTORY PREDICTION

PCF's prediction target is primarily:

$$
P(
X_{t+\Delta}
\mid
X_{\le t}
)
$$

not arbitrary external-event prediction.

Possible targets include:

```text
Which dormant idea will reactivate?
Which question is becoming a project?
Which Fields are converging?
Which belief is likely to be reconsidered?
Which contradiction is approaching resolution?
Which operator is likely to help?
Which concept cluster is losing momentum?
```

Every prediction must include:

```text
data cutoff
horizon
model version
features used
probability/distribution
uncertainty
eventual outcome
```

No prediction may be added retrospectively.

---

## 32. PREDICTION BASELINES

Complex prediction is forbidden until it beats:

```text
persistence
recency
frequency/base-rate
exponential smoothing
simple Markov transition
deterministic PCF relevance
```

Evaluation is prequential:

$$
Train_{\le t}
\rightarrow
Predict_{t+\Delta}
\rightarrow
FreezePrediction
\rightarrow
ObserveOutcome
\rightarrow
Score
$$

Metrics may include:

- Brier score;
- log loss;
- calibration error;
- rank metrics;
- interval/coverage metrics;
- usefulness;
- user action following prediction.

Because this is one person's longitudinal system, prediction should be described as **operationally calibrated personal forecasting**, not confirmatory population science.

VEDA's own audit concluded that n=1 cannot support the kind of confirmatory claims its JSM pathway attempted. [session citation: turn11file3 L214-L221]

---

## 33. POSSIBILITY MODEL

Prediction asks:

> Where will cognition probably go naturally?

PCF also requires:

> Where could it productively go?

Define:

$$
PossibleStates_{t+\Delta}
=
Generate(
X_t,
Graph_t,
Memory_t,
Constraints_t
)
$$

Candidate possibilities are evaluated independently for:

```text
personal novelty
grounding
bridge value
structural coherence
actionability
epistemic risk
```

Prediction and possibility must remain separate.

A low-probability state may be a very valuable possibility.

---

## 34. INTERVENTION MODEL

The highest-level future problem is not:

$$
Predict(X_{t+\Delta})
$$

It is:

$$
\arg\max_a
E[
CognitiveValue_{t+\Delta}
\mid
do(a),X_t
]
$$

where $a$ may be:

```text
resurface memory
show contradiction
show metaphor
connect Fields
expand adjacent possibilities
challenge assumption
propose experiment
ask a question
do nothing
```

Until causal evidence exists, PCF may optimize predicted intervention utility.

It must label this distinction.

---

## 35. THE ASTROLABE POLICY

Let:

$$
\pi_\theta(a\mid X_t)
$$

be the policy choosing cognitive intervention $a$.

Input includes:

```text
current Lagna
rerooted Field
temporal regime
momentum
applicability
novelty state
recent intervention history
user intent
cognitive load
```

The action space contains:

$$
DO\_NOTHING
$$

as a first-class option.

A system that always intervenes has failed.

---

## 36. CREATIVE SEARCH POLICY

Exploration breadth should adapt to progress.

Define a progress signal:

$$
Progress_t
$$

derived from:

- useful new relations;
- resolved questions;
- successful experiments;
- belief refinement;
- novel output;
- user feedback.

When:

$$
Progress_t \uparrow
$$

PCF may favor exploitation.

When:

$$
Progress_t \approx 0
$$

for sustained periods:

$$
ExplorationBreadth\uparrow
$$

Potential expansion mechanisms:

```text
greater semantic distance
cross-House retrieval
Parallel Fields
old experience retrieval
metaphor search
rare circuit activation
Rahu/Jupiter-like operator modes
```

This is a learnable policy, not a fixed rule.

---

## 37. PCF DREAMING

PCF Dreaming is the offline consolidation and policy-improvement cycle.

It is not anthropomorphic sleep.

It is computational replay.

### Cycle

```text
EXPERIENCE
    ↓
append-only trace
    ↓
replay
    ↓
candidate policy generation
    ↓
historical / shadow evaluation
    ↓
safety + epistemic evaluation
    ↓
limited online test
    ↓
PROMOTE or ROLLBACK
    ↓
new experience
    ↺
```

Dreaming may eventually optimize:

```text
retrieval weighting
operator routing
exploration breadth
resurfacing policy
metaphor search policy
plasticity parameters
decay parameters
context construction
```

Dreaming may **not** directly rewrite:

```text
raw user content
accepted factual claims
sources
user-authored relations
historical events
```

---

## 38. DREAMING IS NOT AN EXACT SIMULATOR

Unlike an algorithm-discovery trace, human cognitive history contains only the action that actually occurred.

It does not contain the counterfactual outcome:

> What would have happened had PCF shown B instead of A?

Therefore historical replay is not ground truth.

PCF Dreaming must distinguish:

```text
OBSERVED OUTCOME
OFF-POLICY ESTIMATE
MODELLED COUNTERFACTUAL
```

These cannot share an epistemic status.

---

## 39. OFF-POLICY LEARNING REQUIREMENTS

Future Astrolabe traces should eventually record:

```text
state snapshot/hash
candidate interventions
chosen intervention
policy version
selection probability / propensity
immediate outcome
delayed outcomes
```

With propensities, candidate future methods include:

$$
IPS
$$

inverse propensity scoring,

and:

$$
DoublyRobust
$$

estimators.

Model-generated counterfactuals may help generate hypotheses.

They may not count as observed evidence.

---

## 40. DREAMING PROMOTION GATE

A candidate Astrolabe policy cannot replace the incumbent merely because one score improves.

Required future promotion dimensions include:

```text
usefulness
grounding
calibration
diversity
epistemic integrity
stability
latency/cost
user autonomy
regression on previously solved cases
```

The incumbent policy is always a candidate.

Rollback must be trivial.

Every policy is versioned.

---

## 41. NOVEL COGNITIVE YIELD

The long-term north-star remains:

### Novel Cognitive Yield — NCY

Conceptually:

$$
NCY
=
Useful
\times
NonObvious
\times
Grounded
\times
Consequential
$$

It should not become an opaque engagement score.

Candidate observable proxies:

```text
user marks useful
user follows connection
new thought created
question refined
belief updated
experiment created
project changed
idea revisited later
cross-domain bridge reused
```

Negative signals:

```text
dismissed
not useful
redundant
overwhelming
unexplained
unsupported
repeated without value
```

Long-horizon outcomes should outweigh immediate clicks when evidence becomes sufficient.

---

## 42. PERSONAL CURIOSITY FUNCTION

One ultimate research target is:

$$
C_u(x,t)
=
P(
x
\text{ is surprising and valuable to user }u
\mid
State_t
)
$$

This is not:

> what does the user agree with?

It is:

> what is likely to create productive intellectual motion?

The system must deliberately preserve exploration outside the learned user model.

Otherwise personalization degenerates into a cognitive filter bubble.

---

## 43. DENSE-WEAK ENSEMBLES

VEDA's Aṣṭakavarga work suggests another candidate principle:

> many weak individually unimpressive signals may matter collectively.

PCF may test:

$$
S_t
=
\sum_i w_i s_i(t)
$$

against an analytic or empirical null.

But the system must avoid per-cell screening that destroys a dense-weak effect.

This becomes a research candidate for:

- many small memory cues;
- weak cross-domain similarities;
- subtle relation signals;
- distributed evidence for resurfacing.

The ensemble must beat:

```text
best individual signal
simple sum
random equal weights
```

before adoption.

---

## 44. BOUNDARY UNCERTAINTY — SANDHI

Any discretization creates boundaries.

If a continuous value $x$ is close to a category boundary $b$:

$$
d(x,b)<\epsilon
$$

PCF should express uncertainty rather than pretending category membership is exact.

This applies to:

```text
regime boundaries
cluster assignment
House dominance
topic state
activation thresholds
prediction bands
```

This is the computational inheritance of Sandhi.

The boundary itself does not imply danger or weakness.

It implies:

> **classification uncertainty.**

---

## 45. PERSONAL SEMANTIC GEOMETRY

Generic embeddings describe population semantic geometry.

PCF may eventually learn:

$$
z_i^{personal}
=
f_\theta(
z_i^{generic},
History_u
)
$$

The transformation should learn which conceptual distinctions and bridges matter to the individual.

Positive supervision:

```text
useful connection
saved
revisited
acted on
generated follow-up
```

Negative supervision:

```text
dismissed
redundant
obvious
irrelevant
```

The first learned baseline should be simple.

Before neural metric learning, test:

```text
BM25 / lexical
concept overlap
PPMI
truncated SVD of personal PPMI
generic embeddings
generic + reranking
```

Neural personal geometry is admitted only if it beats these.

---

## 46. REPRESENTATIONAL PLASTICITY

If personal geometry demonstrates value, $Z_t$ becomes plastic.

This does not mean rewriting canonical concepts.

It means:

$$
Distance_t(A,B)
$$

can evolve because the user repeatedly discovers meaningful structure connecting them.

Thus:

$$
Distance_{generic}(A,B)
\neq
Distance_{personal,t}(A,B)
$$

The learned space itself becomes a form of implicit memory.

---

## 47. STRUCTURAL PLASTICITY

PCNG topology may eventually grow and prune.

### Grow

Only after:

```text
candidate generation
→ statistical/null gate
→ repeated support
→ non-negative utility
→ epistemic labeling
```

### Strengthen

After repeated useful activation.

### Weaken

After repeated irrelevance, contradiction, or non-use.

### Dormancy

Preserve recoverability without occupying active topology.

### Prune

Remove only learned derived structure.

Never destroy canonical evidence/history because an implicit model stopped using it.

---

## 48. FAST AND SLOW PLASTICITY

PCF should separate at least two learning timescales.

### Fast state

Changes rapidly:

```text
activation
working Field
temporary relevance
current momentum
local operator routing
```

### Slow state

Changes after consolidation:

```text
durable influence weights
personal semantic geometry
operator preference
circuits
policy
```

Conceptually:

$$
Fast_t
\rightarrow
Replay
\rightarrow
Validation
\rightarrow
Slow_{t+1}
$$

A surprising event may immediately alter attention.

It should not immediately rewrite long-term structure.

---

## 49. LIFE EXPERIENCE AS COGNITIVE DATA

PCF's future object system may need to distinguish experiences from ordinary propositions.

This document does not modify the Phase 1 object enum.

Instead it establishes a research requirement:

> Life experiences must eventually be representable as structured episodes capable of participating in metaphor, trajectory and causal reasoning.

An episode may later derive:

```text
actors
setting
goal
constraints
action
turning point
outcome
lesson
emotional/cognitive salience
```

Raw narrative remains canonical.

Structure remains derived.

---

## 50. GLOBAL CONTEXT VS PERSONAL CONTEXT

VEDA's transit research provided a critical warning:

> a shared clock can drive timing while carrying no information about the individual.

PCF therefore separates:

$$
GlobalContext_t
$$

from:

$$
PersonalState_{u,t}
$$

A major public event may trigger thousands of users simultaneously.

That must not be counted as evidence that PCF has learned a unique personal transition.

Prediction models require explicit ablations:

```text
global only
personal only
global + personal
```

---

## 51. RESEARCH EVALUATION LADDER

A mechanism progresses through:

### L0 — Structural correctness

Does the math/code do what it claims?

### L1 — Synthetic recovery

Can it recover a planted mechanism?

### L2 — Hostile synthetic testing

Does it refuse noise and adversarial cases?

### L3 — Retrospective personal evaluation

Does it explain held-out historical patterns without leakage?

### L4 — Prequential personal prediction

Does it predict future state better than baselines?

### L5 — Intervention evaluation

Does using the mechanism improve future cognitive outcomes?

No mechanism may skip levels by rhetoric.

---

## 52. MINIMUM BASELINES

Every new mechanism must compete against the cheapest plausible alternative.

Examples:

| Proposed mechanism | Required baseline |
|---|---|
| Personal embeddings | lexical + PPMI/SVD |
| Neural retrieval | deterministic relevance |
| Learned regime model | simple changepoint / Markov |
| GNN | common neighbors / PageRank / random walks |
| Higher-order circuit | pairwise model |
| Metaphor learner | semantic similarity + structural rules |
| Learned policy | fixed operator policy |
| Dreaming | incumbent policy / no-learning |
| Neural plasticity | deterministic reinforcement counts |
| Prediction | base rate / persistence / recency |

Complexity earns admission.

---

## 53. FUTURE-STATE DATA DISCIPLINE

Every learned result must carry:

```text
created_at
data_cutoff
feature_version
model_version
training_window
evaluation_window
provenance
uncertainty
epistemic_stage
```

No full-history feature may be used to simulate a past prediction.

No private personal data belongs in:

```text
source defaults
test fixtures committed to git
example constants
commit messages
public artifacts
```

VEDA's forensic audit found precisely this privacy failure in tracked project files; PCF must make it structurally impossible rather than relying on memory or convention. [session citation: turn10file4 L102-L115]

---

## 54. ASTROLABE EXPLANATION CONTRACT

Every cognitive intervention must eventually be able to answer:

```text
WHY NOW?
WHY THIS?
WHAT PAST MEMORY CONTRIBUTED?
WHAT RELATIONSHIP WAS USED?
WHAT IS OBSERVED VS INFERRED?
WHAT IS THE NOVEL PART?
WHAT COULD DEFEAT THIS?
HOW CONFIDENT ARE WE?
WHAT WOULD MAKE PCF ABSTAIN?
```

This is mandatory.

A powerful system that cannot answer these questions is not an acceptable PCF architecture.

---

## 55. ASTROLABE RESEARCH PIPELINE

The complete future transformation is:

```text
NEW INPUT / EXPERIENCE
        │
        ▼
CAUSAL SNAPSHOT
history available only through t
        │
        ▼
EPISODIC + SEMANTIC EXTRACTION
        │
        ▼
COGNITIVE LAGNA
choose current reference frame
        │
        ▼
RE-ROOT FIELD
        │
        ▼
TEMPORAL STATE
activation + momentum + regime
        │
        ▼
RELATIONAL STATE
directed influence + circuits + defeaters
        │
        ▼
APPLICABILITY
may this method infer here?
        │
   NO ──┴── YES
   │         │
ABSTAIN      ▼
        CANDIDATE INTERVENTIONS
                 │
                 ▼
        NOVELTY + NULL GATES
                 │
                 ▼
          ASTROLABE POLICY
                 │
                 ▼
       COGNITIVE INTERVENTION
                 │
                 ▼
               HUMAN
                 │
                 ▼
        OUTCOME / EXPERIENCE
                 │
                 ▼
          APPEND-ONLY TRACE
                 │
                 ▼
            PCF DREAMING
                 │
                 └──────────────↺
```

---

## 56. THE VEDIC GRAMMAR AFTER FORENSIC AUDIT

The mature research mapping is therefore:

```text
LAGNA
reference frame
        ↓

BHĀVA
semantic domain coordinates
        ↓

GRAHA
candidate cognitive operator family
        ↓

RĀŚI
experimental processing-mode hypothesis only
        ↓

NAKSHATRA
experimental fine-state hypothesis only
        ↓

DṚṢṬI
directed influence
        ↓

YUTI
coactivation
        ↓

YOGA
learned higher-order circuit
        ↓

BHANGA
defeater / cancellation / reversal
        ↓

ARGALA
support / obstruction / contested state
        ↓

BALA
contextual learned effectiveness,
NOT traditional fixed strength
        ↓

DAŚĀ
hierarchical learned temporal regimes,
NOT birth-keyed fate clock
        ↓

VARGA PRINCIPLE
parallel projections,
NOT duplicated evidence
        ↓

AṢṬAKAVARGA PRINCIPLE
dense weak ensemble + explicit null
        ↓

SANDHI
boundary uncertainty
```

The traditional terminology is useful as an interpretable research grammar.

The mathematics must be learned and validated independently.

---

## 57. WHAT IS ACTUALLY NOVEL IN PCF

The forensic report makes the boundary unusually clear.

VEDA already supplied:

```text
provenance discipline
re-rooting
relational graphs
directed influence
null models
factorized temporal inference
rule mining
defeaters
metaphor mining
novelty measures
applicability
```

PCF adds:

```text
persistent personal cognitive state
online plasticity
synaptic reinforcement and decay
graph growth and pruning
personal semantic geometry
spreading activation
metaplasticity
homeostasis
cognitive momentum
cognitive acceleration
longitudinal trajectory learning
personal metaphor learning
creative trajectory learning
intervention policy learning
PCF Dreaming
recursive improvement of that policy
```

The report explicitly identifies these learning/plasticity/momentum/trajectory layers as the genuinely new territory relative to VEDA. [session citation: turn9file0 L10-L17]

---

## 58. CORE RESEARCH QUESTION

The principal research question becomes:

> **Can a persistent, user-owned cognitive graph become a plastic neuro-symbolic field whose structure, representations and intervention policy adapt through one person's lived intellectual history—and can those adaptations measurably increase useful discovery without sacrificing epistemic integrity or human agency?**

---

## 59. SECONDARY RESEARCH QUESTIONS

1. Does Cognitive Lagna re-rooting improve retrieval and discovery over a fixed global representation?

2. Does null-gated structural plasticity produce a more useful personal graph than LLM-proposed relations alone?

3. Does personal semantic geometry outperform generic embeddings for predicting useful connections?

4. Does momentum improve the timing of cognitive interventions?

5. Can higher-order circuits predict useful discoveries beyond pairwise relationships?

6. Does constraint tension identify creative combinations better than semantic distance?

7. Can structural metaphor matching across lived experiences produce useful interventions?

8. Do learned temporal regimes improve Promise × Timing × Trigger prediction?

9. Can the Astrolabe learn when to abstain?

10. Can PCF Dreaming improve the policy without degrading diversity, grounding or user agency?

11. Can intervention models outperform merely predicting the user's next thought?

12. Can PCF preserve surprise even after learning the individual's curiosity function?

---

## 60. REQUIRED FALSIFIERS

The architecture must be willing to die by evidence.

Examples:

#### Re-rooting falsifier

Fixed retrieval consistently beats re-rooted retrieval.

#### Neural graph falsifier

Deterministic graph scoring matches or outperforms learned plastic edges.

#### Personal embedding falsifier

Generic embedding + simple reranking performs as well as personalized geometry.

#### Momentum falsifier

Momentum features add no held-out information over recency.

#### Regime falsifier

Simple continuous state models outperform discrete regimes.

#### Metaphor falsifier

Structural metaphor recommendations are no more useful than semantic-neighbor recommendations.

#### Circuit falsifier

Higher-order interactions fail to improve held-out predictions beyond pairwise models.

#### Dreaming falsifier

Policy adaptation produces no stable out-of-sample improvement over the frozen policy.

#### Vedic grammar falsifier

Alternative neutral parameterizations match or beat Vedic-inspired parameterizations consistently.

If so:

> Preserve the successful mathematics.

> Drop the Vedic framing.

---

## 61. RESEARCH STAGING

### Research Stage A — Instrumentation

Prerequisite:

PCF v0.1 proves useful enough to generate genuine longitudinal use.

Add no neural complexity.

Need:

```text
complete event traces
operator outcomes
feedback
retrieval exposures
timestamps
prediction ledger
```

### Research Stage B — Temporal State

Test:

```text
activation
multi-timescale momentum
regime detection
```

against simple baselines.

### Research Stage C — Relation Statistics

Test:

```text
personal nulls
surprise bits
directed influence
null-gated candidate edges
```

No online weight learning yet.

### Research Stage D — Plastic Graph

Introduce:

```text
potentiation
decay
dormancy
pruning
homeostasis
```

only after C wins.

### Research Stage E — Personal Representation

Compare:

```text
PPMI/SVD
generic embeddings
personal reranking
metric learning
```

### Research Stage F — Higher-Order Circuits

Mine/confirm interactions.

### Research Stage G — Predictive Cognitive State

Prequential trajectory forecasting.

### Research Stage H — Astrolabe Policy Learning

Contextual intervention selection.

### Research Stage I — PCF Dreaming

Offline policy improvement with guarded online promotion.

### Research Stage J — Model Adaptation

Only after the previous layers demonstrate that modifying underlying model weights provides incremental value.

Potential:

```text
personal adapter
LoRA
small local model
```

Canonical PCF memory remains independent.

---

## 62. PERMANENT PROHIBITIONS

Mature PCF must never become:

```text
a black-box personality model
a horoscope engine disguised as cognition
an engagement-maximizing recommender
an unbounded agent swarm
a graph that equates correlation with causation
a system that silently rewrites beliefs
a model whose personal memory exists only in weights
a predictor that leaks future data
a certainty machine
a self-improvement loop without rollback
```

---

## 63. THE ASTROLABE'S ULTIMATE JOB

The Astrolabe should eventually answer four questions:

$$
STATE:
\quad
Where is this person's cognition now?
$$

$$
MOMENTUM:
\quad
Where is it naturally moving?
$$

$$
POSSIBILITY:
\quad
What useful states are adjacent but not yet reached?
$$

$$
INTERVENTION:
\quad
What, if anything, should PCF surface now to improve the trajectory?
$$

Thus:

```text
STATE MODEL
      │
      ├──→ MOMENTUM MODEL
      │
      ├──→ POSSIBILITY MODEL
      │
      └──→ INTERVENTION MODEL
                    │
                    ▼
               ASTROLABE
                    │
                    ▼
                  HUMAN
                    │
                    ▼
               EXPERIENCE
                    │
                    ▼
              PCF DREAMING
                    │
                    └──────↺
```

---

## 64. FINAL ARCHITECTURAL FORM

```text
                       HUMAN
                         │
                         ▼
                  EXPERIENCE STREAM
                         │
                         ▼
              ┌──────────────────────┐
              │ CANONICAL PCF MEMORY │
              │                      │
              │ Objects              │
              │ Claims               │
              │ Sources              │
              │ Relations            │
              │ Events               │
              │ Feedback             │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ PERSONAL COGNITIVE   │
              │    NEURAL GRAPH      │
              │                      │
              │ Activation           │
              │ Influence            │
              │ Plasticity           │
              │ Personal geometry    │
              │ Circuits             │
              │ Momentum             │
              │ Regimes              │
              └──────────┬───────────┘
                         │
                         ▼
              ╔══════════════════════╗
              ║      ASTROLABE       ║
              ║                      ║
              ║ Re-root              ║
              ║ Orient               ║
              ║ Diagnose             ║
              ║ Predict              ║
              ║ Explore              ║
              ║ Intervene            ║
              ║ Abstain              ║
              ╚══════════╤═══════════╝
                         │
                         ▼
                  AI REASONERS
                replaceable engines
                         │
                         ▼
             COGNITIVE INTERVENTION
                         │
                         ▼
                       HUMAN
                         │
                         ▼
                     OUTCOME
                         │
                         ▼
                  PCF DREAMING
                         │
                         └──────────────↺
```

The foundation model provides broad intelligence.

PCF provides personal continuity.

PCNG provides adaptive structure.

The Astrolabe provides relational and temporal navigation.

Dreaming improves the navigation policy.

The human remains the source of agency and lived consequence.

---

## 65. NORTH STAR

The mature objective is not:

> Remember everything about the user.

Nor:

> Predict everything the user will do.

Nor:

> Make AI autonomous.

It is:

> **Learn the evolving structure of a person's intellectual life well enough to place the right memory, contradiction, metaphor, question, possibility, or challenge into their path at the moment when it can most increase their capacity for useful discovery.**

And then:

> **Learn from whether that intervention actually helped.**

That is the research program.
