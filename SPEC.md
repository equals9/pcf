| **Status**                      | FROZEN BUILD CONTRACT                                                                                         |
|---------------------------------|---------------------------------------------------------------------------------------------------------------|
| **Version**                     | 0.1.0                                                                                                         |
| **Working repo name**           | pcf                                                                                                           |
| **Implementation target**       | Local single-user prototype                                                                                   |
| **Primary reasoner**            | Authenticated Claude Code CLI using the user's existing Claude subscription                                   |
| **Canonical persistence**       | Local SQLite                                                                                                  |
| **Primary UI**                  | Today                                                                                                         |
| **Primary validation question** | Can this system take a stream of thoughts and repeatedly surface connections that help the user think better? |

# 0. Build Directive

This document is authoritative. Claude Code MUST:

**1.** Build only the features explicitly specified here.

**2.** Prefer the simplest implementation satisfying the acceptance
tests.

**3.** Keep the application local-first and single-user.

**4.** Use SQLite as canonical state.

**5.** Treat Claude as a replaceable reasoning engine, never as
canonical memory.

**6.** Preserve cognitive history rather than silently overwriting it.

**7.** Validate every LLM-generated structured object before
persistence.

**8.** Never create additional product surfaces merely because they seem
useful.

**9.** Never add authentication, cloud infrastructure, sync,
collaboration, plugins, dashboards, theming, or mobile support.

**10.** Stop and document a blocker instead of inventing architecture
outside this specification.

Any feature not explicitly permitted by this document is prohibited in
v0.1.

# 1. Product Constitution

## 1.1 Canonical definition

Personal Cognitive Field is a time-first, local-first, AI-native
environment that models a person's evolving intellectual state as
structured objects, relationships, beliefs, and events; uses a
Vedic-inspired cognitive grammar to organize and operate on thought; and
surfaces relevant memories, contradictions, and adjacent possibilities
to produce useful new thinking.

It is not primarily a note-taking application.

It is not:

- a Notion replacement

- an Obsidian clone

- a document editor

- a project-management suite

- a database builder

- a generic chatbot

- a dashboard builder

- an autonomous-agent platform

The user's thinking process is the product.

# 2. North Star

The v0.1 product question is: Can the system turn accumulated thought
into useful new thought?

## Novel Cognitive Yield (NCY)

A successful cognitive intervention produces an idea, connection,
contradiction, question, or action that:

**1.** is relevant to the user's current thought

**2.** is not trivially obvious

**3.** is grounded in existing user material

**4.** changes or advances subsequent thinking

v0.1 does not attempt automated NCY measurement. Instead, collect
explicit lightweight feedback:

useful  
not_useful  
saved  
opened  
acted_on

These events create the future training set.

# 3. Non-Negotiable Product Principles

## P1 — Thinking precedes organization

The user never needs to select a folder, database, template, house,
object type, tag, or destination before capturing a thought. Capture
comes first. Structure follows.

## P2 — Time is the root navigation coordinate

The application always opens on Today. The default orientation is “Where
am I now?” rather than “Where did I file this?”

## P3 — Structure is inferred

AI may propose object type, title, concepts, claims, house coordinates,
and relationships. User corrections override AI inference.

## P4 — User memory belongs outside the model

Canonical memory is stored locally. Claude receives retrieved context
only when reasoning is required. MODEL ≠ MEMORY.

## P5 — AI performs cognitive operations

There is no primary generic Ask AI interface. v0.1 exposes exactly four
explicit cognitive operations: ☿ Connect, ♃ Expand, ♄ Challenge, ♂ Act.

## P6 — Knowledge has epistemic state

The system distinguishes thought, idea, question, claim, evidence, and
belief. Claims may contradict one another. Beliefs may evolve. History
is preserved.

## P7 — Connections are contextual

The product must not display the full knowledge graph by default. The
visible graph represents the active neighborhood of the current object.
Maximum constellation nodes in v0.1: 12 plus the anchor.

## P8 — Relevant-but-different beats merely similar

Retrieval must penalize redundant results. Five nearly identical
memories are inferior to several complementary relevant ones.

## P9 — AI proposes; user remains authority

AI must not silently change a belief, delete content, accept a
relationship, merge objects, or resolve a contradiction.

## P10 — Opinionated defaults beat configurability

v0.1 contains no template system, theme system, user-created dashboards,
workflow builder, or user-defined schemas.

# 4. v0.1 User Loop

OPEN APP  
↓  
TODAY  
↓  
CAPTURE THOUGHT  
↓  
EXTRACT STRUCTURE  
↓  
CLASSIFY INTO HOUSE VECTOR  
↓  
STORE LOCALLY  
↓  
FIND RELATED MEMORY  
↓  
SHOW CONSTELLATION  
↓  
OPTIONALLY INVOKE:  
CONNECT / EXPAND / CHALLENGE / ACT  
↓  
STORE RESULT + FEEDBACK  
↓  
RESURFACE LATER

That is the product. Anything beyond this loop requires explicit
amendment of this spec.

# 5. System Boundary

## Included

- local web application

- Today stream

- raw thought capture

- structured cognitive-object extraction

- concept extraction

- claim extraction

- twelve-house scoring

- local SQLite persistence

- event history

- contextual relevance scoring

- deterministic constellation layout

- four cognitive operators

- one resurfaced-memory card

- primitive contradiction detection

- lightweight feedback

- Claude subscription adapter

## Excluded

See §40 for the complete explicit non-goals.

# 6. Technology Choices

Next.js  
TypeScript  
React  
SQLite  
better-sqlite3  
Zod  
Vitest  
Playwright

Graph visualization: plain React + SVG. Do not introduce a graph
database or large visualization framework in v0.1. Styling may use CSS
modules or Tailwind; choose whichever produces less code in the
scaffold. No external component framework is required.

# 7. Repository Architecture

pcf/  
├── README.md  
├── SPEC.md  
├── package.json  
├── tsconfig.json  
├── next.config.ts  
├── .env.example  
├── .gitignore  
│  
├── app/  
│ ├── layout.tsx  
│ ├── page.tsx  
│ ├── globals.css  
│ └── api/  
│ ├── capture/route.ts  
│ ├── object/\[id\]/route.ts  
│ ├── object/\[id\]/operator/route.ts  
│ ├── object/\[id\]/constellation/route.ts  
│ ├── today/route.ts  
│ └── feedback/route.ts  
│  
├── components/  
│ ├── today/  
│ │ ├── TodayView.tsx  
│ │ ├── DateHeader.tsx  
│ │ ├── CaptureBox.tsx  
│ │ ├── ThoughtStream.tsx  
│ │ ├── ThoughtCard.tsx  
│ │ ├── ResurfacedCard.tsx  
│ │ └── TensionCard.tsx  
│ ├── operators/  
│ │ ├── OperatorBar.tsx  
│ │ └── OperatorResult.tsx  
│ └── constellation/  
│ ├── ConstellationPane.tsx  
│ ├── ConstellationGraph.tsx  
│ ├── ConstellationNode.tsx  
│ └── ConstellationEdge.tsx  
│  
├── lib/  
│ ├── domain/  
│ │ ├── types.ts  
│ │ ├── houses.ts  
│ │ ├── operators.ts  
│ │ ├── relations.ts  
│ │ └── schemas.ts  
│ ├── db/  
│ │ ├── database.ts  
│ │ ├── migrations.ts  
│ │ ├── repositories/  
│ │ │ ├── objects.ts  
│ │ │ ├── concepts.ts  
│ │ │ ├── relations.ts  
│ │ │ ├── claims.ts  
│ │ │ ├── events.ts  
│ │ │ ├── operators.ts  
│ │ │ └── feedback.ts  
│ │ └── migrations/  
│ │ └── 001_initial.sql  
│ ├── ai/  
│ │ ├── reasoner.ts  
│ │ ├── claude-subscription.ts  
│ │ ├── prompts/  
│ │ │ ├── extract.ts  
│ │ │ ├── classify-houses.ts  
│ │ │ ├── infer-relations.ts  
│ │ │ ├── connect.ts  
│ │ │ ├── expand.ts  
│ │ │ ├── challenge.ts  
│ │ │ ├── act.ts  
│ │ │ └── contradiction.ts  
│ │ └── structured-output.ts  
│ ├── engine/  
│ │ ├── capture.ts  
│ │ ├── extract.ts  
│ │ ├── house-classifier.ts  
│ │ ├── relevance.ts  
│ │ ├── constellation.ts  
│ │ ├── relation-inference.ts  
│ │ ├── resurfacing.ts  
│ │ ├── contradiction.ts  
│ │ └── operator-runner.ts  
│ └── utils/  
│ ├── time.ts  
│ ├── math.ts  
│ ├── text.ts  
│ └── ids.ts  
│  
├── scripts/  
│ ├── preflight.ts  
│ ├── migrate.ts  
│ └── seed-demo.ts  
│  
├── data/  
│ └── .gitkeep  
│  
└── tests/  
├── unit/  
├── integration/  
├── acceptance/  
└── fixtures/

No alternate architecture is permitted without spec amendment.

# 8. Canonical Data Model

The primitive is a CognitiveObject. A page is a projection. A note is
not a primitive.

# 9. TypeScript Domain Types

export type CognitiveObjectType =  
\| "thought"  
\| "idea"  
\| "question"  
\| "claim"  
\| "evidence"  
\| "belief"  
\| "decision"  
\| "experiment";  
  
export type ObjectStatus =  
\| "active"  
\| "resolved"  
\| "dormant"  
\| "archived";  
  
export type ProvenanceOrigin =  
\| "user"  
\| "ai_inferred"  
\| "operator";  
  
export interface CognitiveObject {  
id: string;  
type: CognitiveObjectType;  
content: string;  
title: string \| null;  
createdAt: string;  
updatedAt: string;  
lastActivatedAt: string \| null;  
importance: number;  
activation: number;  
status: ObjectStatus;  
provenance: ProvenanceOrigin;  
}  
  
export type HouseNumber =  
\| 1 \| 2 \| 3 \| 4 \| 5 \| 6  
\| 7 \| 8 \| 9 \| 10 \| 11 \| 12;  
  
export type HouseVector = Record\<HouseNumber, number\>;  
  
export interface Concept {  
id: string;  
name: string;  
normalizedName: string;  
}  
  
export type RelationType =  
\| "supports"  
\| "contradicts"  
\| "depends_on"  
\| "causes"  
\| "derived_from"  
\| "analogous_to"  
\| "contains"  
\| "requires"  
\| "answers"  
\| "questions"  
\| "extends"  
\| "supersedes"  
\| "related_to";  
  
export interface Relation {  
id: string;  
sourceId: string;  
targetId: string;  
type: RelationType;  
confidence: number;  
rationale: string \| null;  
origin: "user" \| "ai_inferred" \| "operator";  
status: "proposed" \| "accepted" \| "rejected";  
createdAt: string;  
}  
  
export interface Claim {  
id: string;  
objectId: string;  
normalizedClaim: string;  
subject: string \| null;  
predicate: string \| null;  
objectText: string \| null;  
polarity: "positive" \| "negative" \| "unknown";  
scope: string \| null;  
confidence: number;  
validFrom: string \| null;  
validTo: string \| null;  
}  
  
export type CognitiveOperator =  
\| "mercury_connect"  
\| "jupiter_expand"  
\| "saturn_challenge"  
\| "mars_act";  
  
export type FeedbackAction =  
\| "useful"  
\| "not_useful"  
\| "opened"  
\| "saved"  
\| "acted_on"  
\| "dismissed";  
  
export interface ConstellationNode {  
object: CognitiveObject;  
relevance: number;  
dominantHouse: HouseNumber;  
x: number;  
y: number;  
radius: number;  
}  
  
export interface ConstellationEdge {  
sourceId: string;  
targetId: string;  
relationType: RelationType;  
confidence: number;  
}

All numeric scores are normalized: 0.0 ≤ score ≤ 1.0.

# 10. SQLite Schema

File: lib/db/migrations/001_initial.sql

PRAGMA foreign_keys = ON;  
  
CREATE TABLE objects (  
id TEXT PRIMARY KEY,  
type TEXT NOT NULL CHECK (  
type IN
('thought','idea','question','claim','evidence','belief','decision','experiment')  
),  
content TEXT NOT NULL,  
title TEXT,  
created_at TEXT NOT NULL,  
updated_at TEXT NOT NULL,  
last_activated_at TEXT,  
importance REAL NOT NULL DEFAULT 0.5 CHECK (importance \>= 0 AND
importance \<= 1),  
activation REAL NOT NULL DEFAULT 0.5 CHECK (activation \>= 0 AND
activation \<= 1),  
status TEXT NOT NULL DEFAULT 'active' CHECK (status IN
('active','resolved','dormant','archived')),  
provenance TEXT NOT NULL DEFAULT 'user' CHECK (provenance IN
('user','ai_inferred','operator'))  
);  
  
CREATE INDEX idx_objects_created_at ON objects(created_at);  
CREATE INDEX idx_objects_last_activated ON objects(last_activated_at);  
  
CREATE TABLE house_scores (  
object_id TEXT NOT NULL,  
house INTEGER NOT NULL CHECK (house BETWEEN 1 AND 12),  
score REAL NOT NULL CHECK (score \>= 0 AND score \<= 1),  
PRIMARY KEY (object_id, house),  
FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE  
);  
  
CREATE TABLE concepts (  
id TEXT PRIMARY KEY,  
name TEXT NOT NULL,  
normalized_name TEXT NOT NULL UNIQUE,  
created_at TEXT NOT NULL  
);  
  
CREATE TABLE object_concepts (  
object_id TEXT NOT NULL,  
concept_id TEXT NOT NULL,  
PRIMARY KEY (object_id, concept_id),  
FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,  
FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE  
);  
CREATE INDEX idx_object_concepts_concept ON
object_concepts(concept_id);  
  
CREATE TABLE relations (  
id TEXT PRIMARY KEY,  
source_id TEXT NOT NULL,  
target_id TEXT NOT NULL,  
type TEXT NOT NULL,  
confidence REAL NOT NULL CHECK (confidence \>= 0 AND confidence \<=
1),  
rationale TEXT,  
origin TEXT NOT NULL,  
status TEXT NOT NULL DEFAULT 'proposed',  
created_at TEXT NOT NULL,  
CHECK (source_id \<\> target_id),  
FOREIGN KEY (source_id) REFERENCES objects(id) ON DELETE CASCADE,  
FOREIGN KEY (target_id) REFERENCES objects(id) ON DELETE CASCADE  
);  
CREATE INDEX idx_relations_source ON relations(source_id);  
CREATE INDEX idx_relations_target ON relations(target_id);  
  
CREATE TABLE claims (  
id TEXT PRIMARY KEY,  
object_id TEXT NOT NULL,  
normalized_claim TEXT NOT NULL,  
subject TEXT,  
predicate TEXT,  
object_text TEXT,  
polarity TEXT NOT NULL DEFAULT 'unknown' CHECK (polarity IN
('positive','negative','unknown')),  
scope TEXT,  
confidence REAL NOT NULL CHECK (confidence \>= 0 AND confidence \<=
1),  
valid_from TEXT,  
valid_to TEXT,  
created_at TEXT NOT NULL,  
FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE  
);  
CREATE INDEX idx_claims_object ON claims(object_id);  
  
CREATE TABLE events (  
id TEXT PRIMARY KEY,  
type TEXT NOT NULL,  
object_id TEXT,  
payload_json TEXT NOT NULL,  
created_at TEXT NOT NULL,  
FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE SET NULL  
);  
CREATE INDEX idx_events_created_at ON events(created_at);  
CREATE INDEX idx_events_type ON events(type);  
  
CREATE TABLE operator_runs (  
id TEXT PRIMARY KEY,  
object_id TEXT NOT NULL,  
operator TEXT NOT NULL CHECK (operator IN
('mercury_connect','jupiter_expand','saturn_challenge','mars_act')),  
input_context_json TEXT NOT NULL,  
result_json TEXT NOT NULL,  
created_at TEXT NOT NULL,  
FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE  
);  
  
CREATE TABLE feedback (  
id TEXT PRIMARY KEY,  
target_type TEXT NOT NULL,  
target_id TEXT NOT NULL,  
action TEXT NOT NULL CHECK (action IN
('useful','not_useful','opened','saved','acted_on','dismissed')),  
created_at TEXT NOT NULL  
);  
CREATE INDEX idx_feedback_target ON feedback(target_type, target_id);

The database file must default to ./data/pcf.db and must be gitignored.

# 11. Event Model

Important state changes create append-only events:

OBJECT_CAPTURED  
OBJECT_EXTRACTED  
HOUSE_CLASSIFIED  
RELATION_PROPOSED  
RELATION_ACCEPTED  
RELATION_REJECTED  
OBJECT_OPENED  
OBJECT_RESURFACED  
OPERATOR_INVOKED  
CONTRADICTION_DETECTED  
CONTRADICTION_DISMISSED  
FEEDBACK_RECORDED

Do not implement full event-sourced reconstruction in v0.1. The event
table exists now so longitudinal cognition can be reconstructed later.

# 12. Twelve-House Ontology

House scores are continuous semantic coordinates, not folders. Scores do
not sum to 1. An object may strongly occupy several houses.

| **House** | **Name**       | **Cognitive domain**                                                                                                    |
|-----------|----------------|-------------------------------------------------------------------------------------------------------------------------|
| 1         | Self           | identity; self-model; agency; body; personal direction; beginnings; individual perspective                              |
| 2         | Resources      | values; resources; money; possessions; accumulated knowledge; speech; stored capability                                 |
| 3         | Expression     | communication; writing; learning; skills; experimentation; local discovery; practice through repetition                 |
| 4         | Foundation     | roots; home; internal state; safety; foundational assumptions; emotional base; underlying structure                     |
| 5         | Creation       | creativity; invention; play; generativity; ideas; intelligence; expression of originality                               |
| 6         | Practice       | systems; routine; service; maintenance; problem solving; optimization; workflows; improvement                           |
| 7         | Relation       | partnership; user; counterparty; exchange; negotiation; opposition; one-to-one relationship                             |
| 8         | Transformation | hidden structure; risk; dependencies; deep investigation; transformation; shared resources; failure; unknown mechanisms |
| 9         | Meaning        | philosophy; higher knowledge; frameworks; exploration; research; worldview; teachers; meaning-making                    |
| 10        | Contribution   | career; public work; execution; responsibility; reputation; achievement; visible contribution                           |
| 11        | Network        | community; network; collective intelligence; future aims; gains; coordination; many-to-many systems                     |
| 12        | Beyond         | solitude; subconscious; abstraction; endings; unknown territory; boundary dissolution; retreat; latent material         |

This ontology is frozen for v0.1.

# 13. House Classifier Contract

File: lib/engine/house-classifier.ts

interface HouseClassifierInput {  
content: string;  
title: string \| null;  
concepts: string\[\];  
}  
  
interface HouseClassifierOutput {  
scores: Record\<HouseNumber, number\>;  
dominantHouses: HouseNumber\[\];  
rationale: string;  
}

Validation rules:

**1.** exactly twelve house scores

**2.** every score in \[0,1\]

**3.** at least one score \>= 0.35

**4.** scores do not need to sum to one

**5.** dominantHouses contains 1–4 houses

**6.** every dominant house has score \>= 0.35

AI prompt must state: Score semantic relevance to each domain
independently. Do not force equal distribution. Do not use a natal
chart, transit, personality assumption, or prediction. This is semantic
classification only.

If output fails validation, retry once with validation errors. If still
invalid, persist a neutral fallback vector: all houses = 0; House 3 =
0.5; House 5 = 0.5; House 9 = 0.5. Create an error log. Capture must not
fail permanently because classification failed.

# 14. Extraction Contract

Raw user text is never modified. AI produces metadata around it.

interface ExtractionInput {  
content: string;  
}  
  
interface ExtractionResult {  
type: CognitiveObjectType;  
title: string;  
concepts: Array\<{ name: string }\>;  
claims: Array\<{  
normalizedClaim: string;  
subject: string \| null;  
predicate: string \| null;  
objectText: string \| null;  
polarity: "positive" \| "negative" \| "unknown";  
scope: string \| null;  
confidence: number;  
}\>;  
unresolved: boolean;  
importanceEstimate: number;  
}

Constraints: title ≤ 80 characters; concepts ≤ 8; claims ≤ 3; 0 ≤
importanceEstimate ≤ 1.

Type selection priority:

**1.** explicit question → question

**2.** explicit assertion presented as position → claim

**3.** personally held assertion → belief

**4.** speculative possibility → idea

**5.** intended test → experiment

**6.** decision → decision

**7.** cited observation supporting something → evidence

**8.** otherwise → thought

The raw text remains canonical.

# 15. Capture Pipeline

1\. validate non-empty input  
2. create provisional object (type=thought, provenance=user)  
3. event: OBJECT_CAPTURED  
4. run extraction  
5. update object metadata  
6. upsert concepts  
7. persist claims  
8. event: OBJECT_EXTRACTED  
9. classify house vector  
10. persist 12 house scores  
11. event: HOUSE_CLASSIFIED  
12. retrieve up to 8 relation candidates  
13. run bounded relation inference  
14. persist proposed relationships  
15. return full object

A failure in stages 4–14 must not destroy the raw capture. User text
must be safely stored before AI operations begin.

# 16. Claude Subscription Adapter

Claude Code is a reasoning provider, not application memory.

export interface Reasoner {  
healthCheck(): Promise\<ReasonerHealth\>;  
  
runStructured\<T\>(input: {  
task: string;  
system: string;  
prompt: string;  
schema: z.ZodType\<T\>;  
timeoutMs?: number;  
}): Promise\<T\>;  
}

Implementation: ClaudeSubscriptionReasoner in
lib/ai/claude-subscription.ts.

## Required behavior

**1.** invoke the installed claude executable

**2.** use Claude Code's supported non-interactive mode

**3.** use the authenticated local Claude Code account

**4.** never require ANTHROPIC_API_KEY

**5.** never import @anthropic-ai/sdk

**6.** never call Anthropic HTTP APIs directly

**7.** strip ANTHROPIC_API_KEY from the child-process environment

**8.** preserve all other normal Claude Code authentication state

**9.** capture stdout/stderr separately

**10.** support a configurable timeout

**11.** enforce structured-output validation

**12.** retry malformed structured output a maximum of one time

**13.** run at concurrency 1 in v0.1

Before implementing invocation flags, Claude Code must inspect \`claude
--help\` and use the currently supported
non-interactive/structured-output flags. Do not invent undocumented
flags.

Default model behavior: do not specify a model. Allow the user's Claude
Code default model to remain authoritative. Optional environment
variable PCF_CLAUDE_MODEL may override this later.

## Preflight

scripts/preflight.ts must check: claude exists on PATH; claude --version
succeeds; a non-interactive test invocation succeeds; the database
directory is writable; SQLite migration succeeds. The script must not
inspect or expose credentials.

# 17. Relation Candidate Retrieval

Before asking Claude whether objects relate, deterministically select
candidates.

**1.** find objects sharing at least one concept

**2.** find objects with significant house overlap

**3.** include up to two recent objects

**4.** exclude the new object itself

**5.** rank using v0.1 relevance

**6.** keep maximum 8 candidates

Claude may propose a relationship to a candidate only. It must not
invent non-existent target IDs.

# 18. Relation Inference Contract

interface RelationInferenceInput {  
source: CognitiveObject;  
candidates: Array\<{  
object: CognitiveObject;  
sharedConcepts: string\[\];  
houseSimilarity: number;  
}\>;  
}  
  
interface RelationProposal {  
targetId: string;  
type: RelationType;  
confidence: number;  
rationale: string;  
}

Maximum returned: 3. Minimum persistence confidence: 0.55. All inferred
relations begin as status=proposed and origin=ai_inferred. Proposed
relations may influence constellation relevance at reduced weight.

# 19. Relevance Algorithm

v0.1 relevance must be deterministic. For candidate object c relative to
focus f:

R(c,f) = 0.35C + 0.25H + 0.20G + 0.10T + 0.10F

All components are normalized \[0,1\].

## C — Concept similarity

Use Jaccard similarity: intersection(concepts(f), concepts(c)) /
union(concepts(f), concepts(c)). If both have zero concepts, C = 0.

## H — House similarity

Use cosine similarity between the two 12-dimensional house vectors.

## G — Graph relationship

accepted direct relationship: 1.0 × confidence  
proposed direct relationship: 0.75 × confidence  
two-hop relationship: 0.40  
otherwise: 0

## T — Temporal proximity

Let d = absolute days between creation timestamps. Then T = exp(-d /
45).

## F — Feedback affinity

useful or saved → 1.0  
opened → 0.7  
no feedback → 0.5  
dismissed → 0.2  
not_useful → 0.0

Use the most recent meaningful feedback. No learned model exists in
v0.1.

# 20. Diversity Reranking

Do not simply return the highest twelve relevance scores. Use Maximal
Marginal Relevance (MMR).

MMR(c) = 0.78 \* relevance(c) - 0.22 \* maxSimilarity(c, selected)

Redundancy similarity = 0.60 concept similarity + 0.40 house cosine
similarity. Select until 12 nodes or candidates are exhausted. This
prevents constellation collapse into twelve nearly identical ideas.

# 21. Constellation Algorithm

The current focused object is the Cognitive Lagna. It occupies the
center. The graph is a projection \`Constellation(currentObject)\`, not
the complete global graph.

Maximum node count: 12 related nodes plus anchor.

## Dominant house

Each candidate belongs visually to its highest-scoring house. Ties:
lowest house number wins for deterministic rendering.

## Sector geometry

Divide the circle into twelve equal 30° sectors. House n center angle:
θ(n) = -90° + (n - 1) \* 30°. The exact astrological visual orientation
may change later; for v0.1 this formula is frozen for determinism.

## Radius

radius = 90 + (1 - R) \* 110

Highly relevant nodes sit closer to the anchor.

## Angular jitter

Within a house sector, distribute multiple nodes deterministically using
stable ID hashing. Maximum jitter: ±10°. No physics engine. No random
layout. No persisted manual node positions.

## Node size

size = 8 + activation \* 8

## Edges

Render edges only when a persisted relation exists between visible
nodes. Do not draw similarity edges merely because objects appear near
one another. Edge appearance may distinguish accepted vs proposed, but
must remain visually restrained.

# 22. Resurfacing Algorithm

Today displays at most ONE resurfaced object.

Candidate requirements: created before today; not archived; not
activated in previous 24 hours.

ResurfaceScore = 0.45 × max relevance to today's objects + 0.25 ×
unresolvedness + 0.15 × age saturation + 0.15 × importance

ageSaturation = min(daysOld / 60, 1). unresolvedness: question=1.0;
active claim/belief=0.7; idea=0.6; other=0.3; resolved=0. If Today
contains no objects, omit relevance and renormalize the remaining terms.

When displayed, create OBJECT_RESURFACED event. Do not create a
resurfacing feed.

# 23. Four Cognitive Operators

Each operator receives a retrieval packet, never the entire database.

interface RetrievalPacket {  
focus: CognitiveObject;  
concepts: Concept\[\];  
houseVector: HouseVector;  
relatedObjects: CognitiveObject\[\];  
relations: Relation\[\];  
claims: Claim\[\];  
}

Maximum related objects passed to Claude: 8.

## 23A. ☿ Mercury — Connect

Purpose: discover meaningful relationships between the current object
and existing memory.

interface ConnectResult {  
connections: Array\<{  
targetId: string;  
relationType: RelationType;  
explanation: string;  
whyNonObvious: string;  
confidence: number;  
}\>;  
}

Maximum 3 connections. Target ID must exist; connection must be grounded
in supplied context; generic lexical overlap is insufficient; explicitly
explain why the connection matters. No new object is automatically
created.

## 23B. ♃ Jupiter — Expand

Purpose: generate adjacent possibilities grounded in existing thought.

interface ExpandResult {  
possibilities: Array\<{  
title: string;  
hypothesis: string;  
groundedInObjectIds: string\[\];  
bridgeExplanation: string;  
whyNovel: string;  
nextQuestion: string;  
}\>;  
}

Maximum 3. Every possibility cites at least one supplied object ID; may
combine distant ideas; must distinguish inference from evidence; must
not state speculation as fact. This operator is the v0.1 Adjacent
Possible Engine. No separate autonomous adjacent-possible subsystem is
permitted.

## 23C. ♄ Saturn — Challenge

Purpose: stress-test the current thought.

interface ChallengeResult {  
coreAssumptions: string\[\];  
strongestObjection: string;  
failureModes: string\[\];  
missingEvidence: string\[\];  
alternativeInterpretation: string \| null;  
confidenceAssessment: {  
currentEstimate: number;  
rationale: string;  
};  
}

Maximum 5 assumptions, 5 failure modes, and 5 missing evidence items.
Saturn does not rewrite the user's belief; it exposes weakness.

## 23D. ♂ Mars — Act

Purpose: convert thought into the smallest meaningful test.

interface ActResult {  
experimentTitle: string;  
hypothesis: string;  
smallestAction: string;  
steps: string\[\];  
successCriterion: string;  
failureCriterion: string;  
evidenceToCapture: string\[\];  
}

Maximum 5 steps. Mars must prefer a testable action over generic
productivity advice. No task-management subsystem is created. User may
manually save the result as an experiment object.

# 24. Contradiction Detector

Only operate on objects containing claims. Do not compare every object
against every other object.

## Candidate selection

**1.** retrieve existing claims sharing normalized concepts

**2.** prioritize matching subject/predicate

**3.** keep top 6

**4.** ask Claude to classify each pair

export type ContradictionClass =  
\| "true_contradiction"  
\| "partial_tension"  
\| "scope_difference"  
\| "temporal_change"  
\| "supersession"  
\| "none";  
  
interface ContradictionResult {  
claimAId: string;  
claimBId: string;  
classification: ContradictionClass;  
confidence: number;  
explanation: string;  
unresolvedQuestion: string \| null;  
}

Surface a Tension Card only when classification is true_contradiction,
partial_tension, temporal_change, or supersession and confidence \>=
0.65. Never automatically decide which claim is correct.

# 25. Today Interface

The Today page is the only primary application surface in v0.1.

┌──────────────────────────────────────────────────────────────┐  
│ DATE minimal nav │  
├────────────────────────────────────┬─────────────────────────┤  
│ │ │  
│ What are you thinking? │ CONSTELLATION │  
│ ┌───────────────────────────────┐ │ │  
│ │ │ │ ○ │  
│ └───────────────────────────────┘ │ ○ ◎ ○ │  
│ │ ○ │  
│ TODAY'S THOUGHTS │ │  
│ \[Thought Card\] │ │  
│ ☿ ♃ ♄ ♂ │ │  
│ \[Thought Card\] │ │  
│ RETURN │ │  
│ \[Resurfaced Card\] │ │  
│ TENSION │ │  
│ \[Tension Card\] │ │  
└────────────────────────────────────┴─────────────────────────┘

## 25A. DateHeader

Displays weekday, month, day, and current local date. No productivity
statistics, streak, weather, or quote of the day.

## 25B. CaptureBox

Single multiline field. Placeholder: “What are you thinking?” Keyboard:
Cmd/Ctrl + Enter → capture. Capture clears only after raw content is
safely persisted. No Markdown toolbar.

## 25C. ThoughtStream

Displays only today's objects, newest first. Each card includes time,
title, content preview, dominant house indicator, and four operator
buttons. Do not display all extracted metadata by default.

## 25D. OperatorBar

Exactly: ☿ Connect, ♃ Expand, ♄ Challenge, ♂ Act. No additional AI
actions. Operator results appear inline beneath the selected thought.

## 25E. ResurfacedCard

Maximum one. Shows RETURN; title; short excerpt; age; “Why this
returned.” Buttons: Open, Useful, Dismiss.

## 25F. TensionCard

Maximum one highest-confidence unresolved tension on initial page load.
Shows claim A, claim B, classification, and short explanation. Actions:
Open both, Not a conflict. No belief-resolution wizard in v0.1.

## 25G. ConstellationPane

Always visible on desktop; may collapse. No global graph mode. Anchor is
the currently selected object; if none selected, latest object today; if
no objects, display empty astrolabe-like scaffold with no fake nodes.
Clicking a node changes current focus. No graph editing.

# 26. API Contracts

## POST /api/capture

Request: { "content": "Maybe memory is reconstructable state-transition
history." }  
Response: { "object": {}, "houseVector": {}, "concepts": \[\],
"relations": \[\] }

## GET /api/today

interface TodayResponse {  
date: string;  
objects: CognitiveObject\[\];  
resurfaced: CognitiveObject \| null;  
tension: ContradictionResult \| null;  
}

## GET /api/object/:id/constellation

interface ConstellationResponse {  
anchor: CognitiveObject;  
nodes: ConstellationNode\[\];  
edges: ConstellationEdge\[\];  
}

## POST /api/object/:id/operator

Request: { "operator": "jupiter_expand" }  
Response: { "runId": "...", "operator": "jupiter_expand", "result": {} }

## POST /api/feedback

{ "targetType": "operator_run", "targetId": "...", "action": "useful" }

# 27. Local Privacy Boundary

Canonical application data remains local. However, invoking Claude sends
the selected retrieval packet to Claude through the authenticated Claude
Code subscription. The UI/README must not claim “fully offline” or “all
data stays on device.”

Accurate statement: Your persistent memory is stored locally. Only
selected context is sent to the configured reasoning provider when AI
reasoning is invoked.

# 28. Error Handling

| **Failure**                  | **Required behavior**                                                                                                               |
|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Extraction failure           | Store raw thought; mark metadata incomplete; allow retry.                                                                           |
| House-classification failure | Use fallback vector from §13.                                                                                                       |
| Relation-inference failure   | Save object without proposed relations.                                                                                             |
| Operator failure             | Show “Couldn't complete this operation. Your thought is safe.” No content loss.                                                     |
| Claude unavailable           | App remains usable for capture, viewing, Today stream, and existing constellation data; AI-dependent operations become unavailable. |

# 29. Logging

Development logs may include operation name, duration, schema-validation
result, object IDs, and error type. Do not log Claude credentials, OAuth
material, API keys, or the entire local database.

# 30. Testing Strategy

AI-dependent tests must use a mock Reasoner. Normal automated tests must
not consume Claude subscription usage. Create
tests/fixtures/mock-reasoner.ts with deterministic responses. Only
manual smoke testing invokes actual Claude.

# 31. Unit Acceptance Tests

## Domain

- CognitiveObject types validate

- House numbers outside 1–12 reject

- scores outside \[0,1\] reject

- relation self-links reject

## House vector

- exactly 12 scores required

- cosine similarity works

- dominant-house tie resolution deterministic

## Relevance

- shared concepts increase relevance

- house similarity increases relevance

- direct relation increases relevance

- recent objects receive temporal boost

- dismissed objects receive feedback penalty

## MMR

Pass if three near-duplicate candidates do not automatically consume all
top constellation positions when a comparably relevant diverse candidate
exists.

## Constellation layout

Given identical inputs, x/y output must be identical across runs. No
random graph motion.

# 32. Integration Acceptance Tests

## Capture test

Given “Maybe persistent AI memory should remain outside model weights,”
the pipeline must produce one object, 12 house rows, \>=1 concept,
OBJECT_CAPTURED, OBJECT_EXTRACTED, and HOUSE_CLASSIFIED events.

## Persistence test

Restart application. Captured object remains.

## Relation test

Given related seeded objects, capture of a new related thought produces
no more than 3 proposed relations.

## Operator test

Each of the four operator endpoints validates output, persists
operator_run, and creates OPERATOR_INVOKED event.

## Contradiction test

Fixture Claim A: Personal AI memory should live inside model weights.
Claim B: Personal AI memory should remain outside model weights. Mock
Reasoner classifies true_contradiction. Tension result is surfaced.

# 33. UI Acceptance Tests

| **ID** | **Acceptance**                                                                    |
|--------|-----------------------------------------------------------------------------------|
| A1     | Launching app opens Today.                                                        |
| A2     | There is one primary capture box labeled “What are you thinking?”                 |
| A3     | User captures thought using Cmd/Ctrl + Enter; thought appears in Today stream.    |
| A4     | Thought card exposes exactly four AI operations: Connect, Expand, Challenge, Act. |
| A5     | Selecting a thought changes constellation anchor.                                 |
| A6     | Constellation displays no more than 12 related nodes.                             |
| A7     | Reloading browser preserves previous thoughts.                                    |
| A8     | Today displays no more than one resurfaced card and one tension card.             |

# 34. Subscription-Adapter Acceptance Tests

Automated static check must fail if application dependencies include
@anthropic-ai/sdk or application source directly references
ANTHROPIC_API_KEY except inside the adapter's explicit
environment-removal code or tests.

Manual acceptance: \`claude\` must already show authenticated Claude
subscription before running AI features. Then \`npm run preflight\` must
succeed. No API-key setup flow may exist in the application.

# 35. Seed Data

scripts/seed-demo.ts should create roughly 15 synthetic cognitive
objects covering AI memory, retrieval, knowledge graphs, creativity,
search, human cognition, evidence, and belief change.

Include at least: two related claims; one deliberate contradiction; one
old unresolved question; several cross-house ideas. Seed must contain no
private user data. Purpose: test constellation, resurfacing,
contradiction detection, and four operators.

# 36. Visual Constitution

The visual feeling is quiet, spacious, deliberate, intellectual, zen,
and alive.

It is not an enterprise dashboard, Notion clone, cyberpunk AI interface,
astrology horoscope website, or productivity gamification layer.

Use large whitespace, strong typography, subtle borders, minimal chrome,
one restrained accent, and soft motion only where useful. The astrology
metaphor should initially feel like instrument / astrolabe /
constellation / orientation rather than horoscope / zodiac decoration /
mystical branding.

# 37. Accessibility

- keyboard capture

- keyboard focus states

- buttons with text labels in addition to symbols

- graph information accessible outside pure visual representation

- sufficient contrast

- no meaning conveyed by color alone

# 38. Performance Targets

Local non-AI interactions target \<150 ms perceived response. Today
initial render with existing local state targets \<1 second. AI
operations may take longer and must show clear operation state:
Connecting…, Expanding…, Challenging…, Designing experiment…. Do not
fabricate streaming output unless actual structured streaming is
implemented. v0.1 may wait for completed structured responses.

# 39. Personalization / ML Loop

v0.1 does not train a machine-learning model. It merely records future
training data. Every meaningful interaction can create feedback. Later
versions may learn P(user finds candidate useful \| features) from
features such as semantic similarity, graph distance, house overlap,
temporal distance, novelty, cross-domain distance, operator used, and
past feedback. v0.1 stops at deterministic relevance: no neural network,
classifier training, or reinforcement learning.

# 40. Explicit Non-Goals

## Knowledge-management expansion

- folders

- workspaces

- nested pages

- block editor

- Markdown toolbar

- database builder

- backlinks panel

- global graph

- template marketplace

- import/export suite

- canvas

- whiteboard

- document generation

- spreadsheet functionality

## Customization

- themes

- custom CSS

- widgets

- customizable dashboards

- homepage configuration

- customizable house meanings

- custom object schemas

- plugin architecture

## Collaboration

- user accounts

- teams

- comments

- sharing

- permissions

- multiplayer

- presence

- cloud collaboration

## Cloud infrastructure

- hosted database

- Supabase

- Firebase

- AWS

- Vercel database

- cloud sync

- background cloud jobs

- authentication

## Advanced AI

- agent swarms

- autonomous background agents

- Gemini

- OpenAI

- Codex

- OpenClaw

- Omnigent as runtime dependency

- model routing

- local LLMs

- fine-tuning

- neural-network training

- Graph Neural Networks

- RAG framework

- vector database

- embeddings

## Advanced Vedic features

- natal chart calculation

- birth-data input

- planets as fully separate agents

- sign controls

- nakshatras

- dashas

- transits

- vargas

- real astrological predictions

- personalized Jyotish interpretation

## Media

- audio capture

- video capture

- OCR

- image understanding

- web clipper

- browser extension

- PDF ingestion

## Productivity

- task manager

- calendar integration

- reminders

- streaks

- goals dashboard

- pomodoro

- notifications

- habit tracking

Omnigent may be used to build the application. The application does not
depend on Omnigent. Mars may generate an experiment; that does not
create a task-management system.

# 41. Build Phases

## Phase 0 — Scaffold

Next.js app; TypeScript; SQLite connection; migration runner; Vitest;
Playwright; basic Today shell. Acceptance: npm test and npm run build
green.

## Phase 1 — Domain + persistence

Implement domain types, Zod schemas, migration, repositories, event
writes, seed script. No AI yet. Acceptance: database integration tests
green.

## Phase 2 — Claude subscription adapter

Implement Reasoner interface, ClaudeSubscriptionReasoner, MockReasoner,
preflight script, structured-output validator. No direct Anthropic SDK.
Acceptance: mock tests green; manual preflight documented.

## Phase 3 — Capture intelligence

Implement raw capture, extraction, concept persistence, claim
persistence, house classifier, fallback behavior. Acceptance: capture
integration suite green.

## Phase 4 — Relevance + constellation

Implement relevance score, MMR, relation candidates, relation inference,
deterministic constellation geometry, SVG visualization. Acceptance:
constellation tests green.

## Phase 5 — Four operators

Implement Connect, Expand, Challenge, Act, retrieval packets, operator
persistence, feedback buttons. Acceptance: all four structured contracts
green.

## Phase 6 — Cognitive return

Implement resurfacing, contradiction candidate retrieval, contradiction
classifier, Return card, Tension card. Acceptance: resurfacing +
contradiction suites green.

## Phase 7 — Product polish

Only spacing, typography, loading states, error states, keyboard
usability, basic accessibility. No feature expansion.

# 42. Change Control

**1.** If implementation reveals a missing requirement, do not silently
invent the feature.

**2.** Document the gap in OPEN_QUESTIONS.md.

**3.** Continue building everything not blocked by the gap.

**4.** Request amendment only if the missing decision prevents
implementation.

The builder must not reinterpret ambiguity as permission to expand
scope.

# 43. Definition of Done

- app opens directly to Today

- user can capture a raw thought without organizing it

- raw thought persists before AI inference

- AI extracts structured cognitive metadata

- every object receives a validated 12-house vector

- concepts and claims persist locally

- relation candidates can be inferred

- current object produces deterministic contextual constellation

- constellation contains ≤12 related objects

- Mercury can Connect

- Jupiter can Expand

- Saturn can Challenge

- Mars can Act

- one old relevant thought can resurface

- contradictory claims can produce a Tension card

- feedback events persist

- application remains usable when Claude is unavailable

- canonical data survives restart

- Claude subscription is used through installed Claude Code CLI

- Anthropic API SDK is absent

- no prohibited v0.1 feature has been added

- full automated suite passes

- production build succeeds

# 44. v0.1 Success Test

After implementation, use the product naturally for several days and
capture 20–50 real thoughts. Do not evaluate it primarily on UI polish.

| **Test**            | **Question**                                                                       |
|---------------------|------------------------------------------------------------------------------------|
| A — Recall          | Did it return something genuinely relevant that had left active attention?         |
| B — Connection      | Did Mercury reveal relationships that were not already obvious?                    |
| C — Expansion       | Did Jupiter generate at least occasional adjacent possibilities worth pursuing?    |
| D — Challenge       | Did Saturn expose meaningful assumptions rather than generic criticism?            |
| E — Action          | Did Mars convert abstract thinking into testable action?                           |
| F — Constellation   | Did the contextual graph help orient thought better than a normal backlink list?   |
| G — Cognitive Yield | Did the system cause at least one “Wait — I hadn't connected those before” moment? |

If not, do not expand feature scope. Improve retrieval and cognitive
operations first.

# 45. Product Axiom

The application does not exist  
to help the user organize thought.  
  
It exists to help thought  
become more capable over time.

Everything built must be defensible against that sentence.

# 46. Claude Code Final Execution Instruction

When this file is given to Claude Code, use this implementation
instruction:

> *Implement SPEC.md exactly as written. Treat it as a frozen build
> contract. Work phase-by-phase from Phase 0 through Phase 7, writing
> tests before or alongside each subsystem. Do not add features,
> abstractions, infrastructure, dependencies, or UI surfaces that are
> not required by the spec. Prefer the smallest correct implementation.
> Keep a running BUILD_STATUS.md with completed phase, tests, known
> blockers, and next action. If a requirement is genuinely ambiguous and
> does not block progress, choose the simpler interpretation and
> document it. If it blocks progress, add it to OPEN_QUESTIONS.md; do
> not invent scope. Continue autonomously until all Definition of Done
> items are satisfied or a true external blocker prevents further
> progress.*
