| **Research date** | September 16, 2026                                                                                                            |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Question**      | Which capabilities proven in Obsidian core/community plugins and Roam/Roam Depot should PCF make native rather than optional? |
| **Decision rule** | Absorb cognitive primitives; reject configuration machinery.                                                                  |
| **Scope effect**  | No automatic change to frozen PCF v0.1 unless explicitly amended.                                                             |

# Executive Conclusion

The plugin ecosystems strongly validate the PCF thesis. The
highest-value plugins repeatedly solve the same missing primitives:
resurfacing, semantic connection, typed relationships, fast retrieval,
atomic references, temporal navigation, contextual parallel panes,
automation around capture, and generated views over structured data. PCF
should make these primitives native, but should not copy the
configuration-heavy implementation style that forces users to design
their own knowledge system.

The right move is not “support these plugins.” It is: absorb the best
ideas into the cognitive engine, give them opinionated defaults, and let
AI perform the organization work.

# 1. What Obsidian Core Already Proves

Obsidian now ships a substantial set of core capabilities including
Daily Notes, Backlinks, Bases, Canvas, Graph View, Search, Quick
Switcher, Properties, Templates, Bookmarks, Page Preview, Workspaces,
and more. The important signal is not that PCF needs equivalents for all
of them. It is that the features that began as power-user needs often
become platform primitives once their usefulness is broadly proven.

| **Obsidian core capability** | **Lesson for PCF**                                                              | **PCF decision**                                                       |
|------------------------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------|
| Daily Notes                  | Time is a natural default entry point.                                          | Already native: Today is the root coordinate.                          |
| Backlinks / Outgoing Links   | Users need visibility into incoming and outgoing context.                       | Native, but typed and AI-ranked rather than a raw list.                |
| Bases                        | Structured metadata eventually demands useful projections/views.                | Later native “Lenses”; do not expose database-building in v0.1.        |
| Graph View                   | Relationship visualization is useful, but global graphs become hairballs.       | Replace with contextual Constellation only.                            |
| Canvas                       | Spatial thinking is valuable, but unconstrained canvases add arrangement labor. | Do not copy generic canvas; allow contextual spatial projection later. |
| Search / Quick Switcher      | Fast retrieval becomes infrastructure, not a nice-to-have.                      | Make native early; combine lexical + semantic later.                   |
| Page Preview                 | Maintaining context while exploring reduces navigation friction.                | Add native hover/peek after v0.1.                                      |
| Bookmarks                    | Users need a temporary working set.                                             | Later “pin/freeze” constellation nodes, not bookmark folders.          |
| Templates / Workspaces       | Customization solves diverse workflows but increases setup burden.              | Deliberately reject as core PCF product pattern.                       |
| Random Note                  | Serendipity has value but random ≠ relevant.                                    | Replace with activation/resurfacing engine.                            |

# 2. Obsidian Community Plugins Worth Mining

| **Plugin**                | **What it proves**                                                                                                                         | **Relevance** | **PCF interpretation**                                                                                                                                                                                                                                                |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Smart Connections         | Local embeddings automatically surface notes/excerpts semantically related to the current note; no API key required; local-first indexing. | Very high     | PCF should eventually have a local semantic index and contextual connection ranking. Crucially, PCF should combine semantic similarity with graph, time, house vectors, contradictions, and learned personal relevance rather than treating similarity as the answer. |
| Breadcrumbs               | Adds typed directional relationships and builds directed graph views rather than treating every link as equivalent.                        | Very high     | Strong validation of PCF typed Relation model. Add inverse/derived relation rules later, but keep the user-facing system simpler than custom edge configuration.                                                                                                      |
| Dataview                  | Queries the vault as structured data, generating tables/lists/tasks from metadata.                                                         | High          | Do not give users a query language in v0.1. Later create AI-generated “Lenses” that compile natural-language questions into deterministic filters over CognitiveObjects.                                                                                              |
| QuickAdd                  | Combines frictionless capture, templates, macros, and chained actions.                                                                     | High          | Keep frictionless capture and fixed cognitive commands. Reject user-programmable macro complexity initially. Later allow AI-defined capture intents, not macro authoring.                                                                                             |
| Templater                 | Dynamic templates plus JavaScript/system-command execution.                                                                                | Medium        | Evidence that power users want programmable generation, but also evidence of complexity/security cost. PCF should use structured operator contracts rather than arbitrary scriptable templates.                                                                       |
| Omnisearch                | BM25-ranked search, typo tolerance, quoted search, exclusions, keyboard-first navigation, local HTTP access.                               | Very high     | Native search should eventually combine BM25/full-text search with semantic retrieval. A fast command/search palette is one of the strongest post-v0.1 candidates.                                                                                                    |
| Excalidraw                | Deep visual thinking, linked drawings, embeds, scripting, OCR, automation.                                                                 | Medium        | Do not build a general drawing tool. Borrow only the insight that spatial arrangements help thinking; PCF Constellation is the opinionated version.                                                                                                                   |
| Calendar + Periodic Notes | Temporal navigation across daily/weekly/monthly notes.                                                                                     | High          | Today is correct. Add lightweight calendar/date navigation later, but avoid a planning/calendar product.                                                                                                                                                              |
| Spaced Repetition         | Scheduled resurfacing combats forgetting using explicit review algorithms.                                                                 | High          | Do not turn PCF into flashcards. Borrow the principle that resurfacing is a first-class memory operation, but use cognitive activation/relevance instead of recall scheduling.                                                                                        |
| Strange New Worlds        | Surfaces hidden associations around links/block references without requiring users to hunt through backlink panes.                         | Very high     | Exactly aligned with PCF: connections should appear in context rather than require search. Constellation + “why this appeared” should make this native.                                                                                                               |
| Various Complements       | IDE-style context-aware completion while typing.                                                                                           | Medium        | Later opportunity: cognitive autocomplete should suggest concepts/links/questions, not finish prose by default.                                                                                                                                                       |
| Tasks                     | Vault-wide task querying, recurring tasks, filters.                                                                                        | Low for PCF   | Do not absorb task management. Mars produces experiments/actions, but PCF should not become a productivity suite.                                                                                                                                                     |

# 3. Roam: Native Interaction Patterns Worth Preserving

Roam’s strongest contribution is not a plugin. It is the block-level
graph interaction model: Daily Notes, atomic block references, linked
references, zooming into a block, a context-preserving right sidebar,
and fast keyboard navigation. These are closer to PCF’s desired
cognitive behavior than a conventional document model.

| **Roam capability**       | **Why it matters**                                                         | **PCF interpretation**                                                                                    |
|---------------------------|----------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Daily Notes               | A chronological stream lowers the “where do I put this?” decision cost.    | Today remains the only v0.1 home.                                                                         |
| Block References          | One atomic idea can be reused/transcluded without duplication.             | CognitiveObject IDs should remain stable and addressable; add native object reference/transclusion later. |
| Linked References         | Context appears wherever an idea is referenced.                            | PCF relations should show evidence/context around edges, not only counts.                                 |
| Block Zoom                | Lets an atomic thought temporarily become the whole workspace.             | This maps directly to Cognitive Lagna: current focus recenters the system.                                |
| Right Sidebar             | Keeps parallel context open without abandoning the primary thought.        | Strong case for pin/freeze and parallel object previews around the Constellation.                         |
| Keyboard-first navigation | Reduces interface friction during thought.                                 | PCF should remain strongly keyboard-native.                                                               |
| Query Builder             | Visual construction of complex graph queries with AND/OR/NOT/date clauses. | Later: natural-language-to-query “Lens” system; users should not have to learn query syntax.              |

# 4. Roam Depot / RoamJS Extensions Worth Mining

| **Extension**  | **Capability**                                                                                                                  | **Relevance** | **PCF interpretation**                                                                                                                   |
|----------------|---------------------------------------------------------------------------------------------------------------------------------|---------------|------------------------------------------------------------------------------------------------------------------------------------------|
| SmartBlocks    | Programmable workflows/templates that can read/write graph state, execute logic, use dates, search, and call nested workflows.  | High          | Borrow composable cognitive operations internally; do not expose a workflow programming language in v0.1.                                |
| AutoTag        | Automatically links exact page mentions, aliases, natural-language dates, and finds unlinked references.                        | Very high     | Add deterministic entity/alias linking before expensive AI inference. This can improve relation candidate quality and lower model calls. |
| Query Builder  | Visual graph query construction, OR/NOT logic, tables/Kanban views, SmartBlocks integration.                                    | High          | Future Lenses should compile natural language into a query AST and generated view; user should not need to configure views manually.     |
| Workbench      | Power-user bundle: deep navigation, live previews, mind maps, OCR, article import, command palette, privacy mode, weekly notes. | Mixed         | Mine specific primitives (live preview, deep nav, command palette) but reject the “bundle of toggles” product model.                     |
| Quick Switcher | Fast page/block search with aliases and sidebar opening.                                                                        | Very high     | Native command/search palette should be foundational soon after v0.1.                                                                    |
| Breadcrumbs    | Recent-context trail for navigation.                                                                                            | Medium        | PCF can preserve navigation history unobtrusively without exposing another hierarchy system.                                             |
| Pinned Blocks  | Keeps selected child blocks visually available.                                                                                 | High          | Maps cleanly to “pin/freeze this object in my current constellation/working set.”                                                        |

# 5. The Capabilities PCF Should Make Native

## Tier A — Core cognitive primitives

| **Primitive**                  | **Evidence**                                             | **PCF form**                                          | **Timing**                             |
|--------------------------------|----------------------------------------------------------|-------------------------------------------------------|----------------------------------------|
| Time-first capture             | Roam Daily Notes; Obsidian Daily Notes/Calendar          | Today stream + date navigation                        | Already v0.1                           |
| Contextual connections         | Smart Connections; Strange New Worlds; Backlinks         | Constellation + typed relations + explanation         | Already v0.1; semantic upgrade v0.2    |
| Typed relationships            | Breadcrumbs                                              | Relation types + confidence + proposed/accepted state | Already v0.1                           |
| Resurfacing                    | Random Note; Spaced Repetition; Smart Connections        | Activation/relevance-driven Return card               | Already v0.1                           |
| Atomic addressability          | Roam block refs                                          | Stable CognitiveObject IDs and object references      | Architecture already supports; UI v0.2 |
| Current-focus recentering      | Roam block zoom                                          | Cognitive Lagna recalculates field around focus       | Already v0.1                           |
| Fast retrieval                 | Omnisearch; Quick Switcher; Roam search                  | Native keyboard search/command palette                | v0.1.1 / v0.2                          |
| Context-preserving parallelism | Roam right sidebar; Page Preview; Workbench Live Preview | Peek, pin/freeze, parallel object pane                | v0.2                                   |
| Semantic indexing              | Smart Connections local embeddings                       | Local embeddings + hybrid reranking                   | v0.2 after baseline metrics            |
| Deterministic auto-linking     | AutoTag, unlinked mentions                               | Aliases/entities exact-match pass before LLM          | v0.2                                   |
| Generated structured views     | Bases, Dataview, Query Builder                           | AI-generated Lenses over CognitiveObjects             | v0.3                                   |

# 6. Features to Study, but NOT Copy Literally

| **Pattern**              | **Why users like it**        | **Why PCF should not copy it**                                          | **Better PCF interpretation**                                               |
|--------------------------|------------------------------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| Templates                | Reduce repeated setup        | Forces users to design their information architecture.                  | AI infers structure automatically; operators are fixed cognitive verbs.     |
| Databases/Bases          | Flexible custom views        | Creates schema and property maintenance work.                           | Lenses generated from fixed cognitive schema.                               |
| Canvas/Excalidraw        | Spatial thinking             | Manual arrangement becomes another maintenance job.                     | Deterministic contextual constellation; optional spatial exploration later. |
| Plugin ecosystems        | Infinite extensibility       | Causes fragmentation, setup burden, security risk, and inconsistent UX. | Strong native primitives + narrow adapters/integrations.                    |
| Workspaces               | Save customized layouts      | Encourages interface management rather than thought.                    | System adapts around current focus automatically.                           |
| Template/macro scripting | Extreme power                | High learning curve and arbitrary execution/security risk.              | Constrained structured operators and later AI-authored safe workflows.      |
| Global graph             | Visually impressive overview | Large graphs become unreadable hairballs.                               | Local relevance field centered on current Cognitive Lagna.                  |
| Task/calendar suite      | Useful productivity layer    | Changes the product category and adds administrative gravity.           | Mars can create experiments/actions, but not task infrastructure.           |

# 7. Recommended Additions After v0.1

## v0.1.1 — Retrieval ergonomics (small, low-risk)

- Native Cmd/Ctrl+K search/quick switcher over object
  title/content/concepts.

- SQLite FTS5/BM25 lexical ranking before any embedding system.

- Hover/peek preview of a constellation node without navigation.

- Pin/freeze one or two nodes while changing Cognitive Lagna.

- Previous day / next day and jump-to-date navigation.

These are usability infrastructure, not new product categories. They can
be added after v0.1 proves the cognitive loop.

## v0.2 — Memory intelligence

- Local embedding model and hybrid lexical + semantic retrieval.

- Atomic CognitiveObject references/transclusion.

- Alias/entity registry plus deterministic unlinked-mention detection.

- Improved “why this appeared” explanations.

- Constellation pin/freeze working set.

- Optional inline connection indicator when a thought has unusually
  strong related memory.

- Belief evolution timeline.

## v0.3 — Dynamic cognitive views

- AI-generated Lenses over the fixed cognitive schema (e.g., “show
  unresolved ideas about memory that connect to VitalCV”).

- Natural-language query compiler to deterministic filter/query AST.

- Source ingestion and grounded evidence views.

- Personalized relevance ranker trained from feedback.

- Periodic synthesis views (week/month) generated from events rather
  than template notes.

# 8. Two Particularly Strong Innovations Suggested by the Research

## 8.1 Replace plugins with Cognitive Primitives

Obsidian and Roam demonstrate a cycle: a host app provides generic
notes/blocks; users discover recurring unmet needs; community plugins
patch them; power users assemble a personalized operating system. PCF
can invert that model. Instead of offering a blank host plus extensions,
PCF can identify the repeatedly proven primitives and make them coherent
from day one.

NOT:  
notes + plugins + templates + scripts  
  
BUT:  
capture + memory + relation + retrieval + operator + return + lens

## 8.2 Make “Querying” an AI responsibility

Dataview, Bases, and Roam Query Builder all prove that users eventually
want to ask structured questions of their knowledge. Their downside is
requiring users to learn schemas, property names, or query syntax. PCF
has a fixed cognitive ontology, so later it can compile plain-language
intent into deterministic queries while showing the user exactly what
was executed.

User: “Show me ideas from the last 90 days that challenge something I
currently believe about AI memory.”  
  
AI compiles → query AST  
Engine executes → deterministic result set  
UI explains → why each object qualified

This preserves the power of Dataview/Query Builder without making the
user become a database administrator.

# 9. Should We Amend the Frozen v0.1 Before Building?

Recommendation: no major amendment. The current v0.1 already contains
the structural foundations that are expensive to retrofit later: stable
object IDs, typed relationships, time, events, concepts, claims,
feedback, deterministic relevance, and a contextual graph. The plugin
research mostly identifies improvements that can sit cleanly on top of
those foundations.

I would not add embeddings, search engines, block transclusion, query
builders, templates, or a plugin system before the first cognitive-loop
test. Doing so would weaken the experiment by making it harder to know
whether PCF is valuable because of its core cognitive model or merely
because it accumulated familiar PKM features.

## One architectural guardrail to preserve now

Treat every CognitiveObject as permanently addressable by stable ID, and
never make the display title or current UI location its identity. That
keeps the door open for Roam-like reference/transclusion, previews,
pins, and generated views later without schema surgery.

# 10. Final Native / Later / Reject Matrix

| **Capability**                       | **Decision**             | **Reason**                                                   |
|--------------------------------------|--------------------------|--------------------------------------------------------------|
| Today / temporal root                | NATIVE NOW               | Central to product thesis.                                   |
| Typed relationships                  | NATIVE NOW               | Core cognitive model.                                        |
| Contextual constellation             | NATIVE NOW               | Core orientation model.                                      |
| Resurfacing                          | NATIVE NOW               | Core memory behavior.                                        |
| Four cognitive operators             | NATIVE NOW               | Core AI interaction model.                                   |
| Contradiction detection              | NATIVE NOW               | Core epistemic behavior.                                     |
| Search / quick switcher              | NATIVE SOON              | Infrastructure-level UX; low conceptual risk.                |
| Local semantic embeddings            | NATIVE LATER             | High value, but baseline should prove value first.           |
| Object references/transclusion       | NATIVE LATER             | Strong Roam primitive; stable IDs already support it.        |
| Peek/right-side context              | NATIVE LATER             | Reduces context switching and suits constellation workflow.  |
| Aliases/unlinked mention detection   | NATIVE LATER             | Cheap deterministic structure before AI inference.           |
| Dynamic Lenses / query engine        | NATIVE LATER             | Power of Dataview/Bases without manual schema work.          |
| Source ingestion / grounded research | NATIVE LATER             | Important NotebookLM-like layer, but not v0.1.               |
| Generic templates                    | REJECT                   | Reintroduces setup burden.                                   |
| Plugin marketplace                   | REJECT FOR EARLY PRODUCT | Fragmentation and user-system-design burden.                 |
| Global graph                         | REJECT                   | Low signal at scale; conflicts with contextual-field thesis. |
| Generic canvas                       | REJECT EARLY             | Manual spatial maintenance.                                  |
| Task manager / calendar suite        | REJECT                   | Pulls product toward administration rather than cognition.   |
| Themes / dashboard builder           | REJECT                   | Exactly the customization trap PCF is meant to escape.       |

# 11. Source Notes

Currentness: sources were checked on September 16, 2026. Obsidian core
features were verified against official Obsidian Help. Community plugin
capabilities were verified against current plugin directory pages. Roam
core/extension behavior was verified against current Roam documentation
and actively maintained RoamJS repositories. Download counts and
versions are snapshots and may change.

1\. Obsidian Help — Core plugins —
[<u>https://obsidian.md/help/plugins</u>](https://obsidian.md/help/plugins)

2\. Obsidian Community — Smart Connections —
[<u>https://community.obsidian.md/plugins/smart-connections</u>](https://community.obsidian.md/plugins/smart-connections)

3\. Obsidian Community — Breadcrumbs —
[<u>https://community.obsidian.md/plugins/breadcrumbs</u>](https://community.obsidian.md/plugins/breadcrumbs)

4\. Obsidian Community — Dataview —
[<u>https://community.obsidian.md/plugins/dataview</u>](https://community.obsidian.md/plugins/dataview)

5\. Obsidian Community — QuickAdd —
[<u>https://community.obsidian.md/plugins/quickadd</u>](https://community.obsidian.md/plugins/quickadd)

6\. Obsidian Community — Templater —
[<u>https://community.obsidian.md/plugins/templater-obsidian</u>](https://community.obsidian.md/plugins/templater-obsidian)

7\. Obsidian Community — Omnisearch —
[<u>https://community.obsidian.md/plugins/omnisearch</u>](https://community.obsidian.md/plugins/omnisearch)

8\. Obsidian Community — Excalidraw —
[<u>https://community.obsidian.md/plugins/obsidian-excalidraw-plugin</u>](https://community.obsidian.md/plugins/obsidian-excalidraw-plugin)

9\. Obsidian Community — Calendar —
[<u>https://community.obsidian.md/plugins/calendar</u>](https://community.obsidian.md/plugins/calendar)

10\. Obsidian Community — Periodic Notes —
[<u>https://community.obsidian.md/plugins/periodic-notes</u>](https://community.obsidian.md/plugins/periodic-notes)

11\. Obsidian Community — Spaced Repetition —
[<u>https://community.obsidian.md/plugins/obsidian-spaced-repetition</u>](https://community.obsidian.md/plugins/obsidian-spaced-repetition)

12\. Obsidian Community — Strange New Worlds —
[<u>https://community.obsidian.md/plugins/obsidian42-strange-new-worlds</u>](https://community.obsidian.md/plugins/obsidian42-strange-new-worlds)

13\. Roam Research Docs — Roam Depot —
[<u>https://roamdocs.fyi/help/roam-depot</u>](https://roamdocs.fyi/help/roam-depot)

14\. Roam Research Docs — Block References —
[<u>https://roamdocs.fyi/help/block-references</u>](https://roamdocs.fyi/help/block-references)

15\. Roam Research Docs — Roam Query Builder —
[<u>https://roamdocs.fyi/help/roam-query-builder</u>](https://roamdocs.fyi/help/roam-query-builder)

16\. RoamJS — SmartBlocks —
[<u>https://github.com/RoamJS/smartblocks</u>](https://github.com/RoamJS/smartblocks)

17\. RoamJS — AutoTag —
[<u>https://github.com/RoamJS/autotag</u>](https://github.com/RoamJS/autotag)

18\. RoamJS — Workbench —
[<u>https://github.com/RoamJS/workbench</u>](https://github.com/RoamJS/workbench)

19\. RoamJS organization overview —
[<u>https://github.com/RoamJS</u>](https://github.com/RoamJS)
