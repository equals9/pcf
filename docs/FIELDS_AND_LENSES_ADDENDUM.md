# PCF Architecture Addendum: Freeze / Parallel Cognitive Fields and AI-Generated Lenses

**Status:** POST-v0.1 ARCHITECTURE CONTEXT — NON-AUTHORITATIVE FOR THE v0.1 BUILD  
**Decision:** These concepts do **not** change the frozen v0.1 foundational data model.  
**Implementation rule:** Do not implement them during v0.1 unless `SPEC.md` is explicitly amended by the user.

## 1. Architectural conclusion

Both concepts are projections over the existing cognitive state:

```text
                    PCF MEMORY
                        │
              Cognitive Objects
              Relations / Claims
              Houses / Events
                        │
             ┌──────────┴──────────┐
             │                     │
          FIELD                  LENS
     "around this"          "matching this"
```

They do not require changing:

- CognitiveObject identity
- object types
- concepts
- house vectors
- typed relations
- claims
- events
- feedback
- created/activation timestamps
- operator history

Future persistence for Fields and Lenses is additive projection state only.

---

# 2. Cognitive Field

A **Field** answers:

> What is meaningfully around this thought right now?

The current focused CognitiveObject is the **Cognitive Lagna** / anchor. The visible constellation is a contextual projection around it, not the global graph.

A live field is computed from:

- anchor object
- relevance algorithm
- selected related objects
- relations among visible objects
- current algorithm version

## Freeze Field

`Freeze Field` stops recomputing the current projection while the user navigates elsewhere.

It does **not** freeze underlying knowledge.

Conceptual future representation:

```ts
interface FieldProjection {
  id: string;
  anchorObjectId: string;
  mode: "live" | "frozen";
  createdAt: string;
  algorithmVersion: string;
  members: Array<{
    objectId: string;
    relevanceAtCapture: number;
  }>;
}
```

This is view/projection state, not a CognitiveObject.

---

# 3. Parallel Cognitive Fields

Parallel Fields allow two frozen or live cognitive neighborhoods to be inspected simultaneously.

Example:

```text
FIELD A                    FIELD B

AI MEMORY                  HSAL

  ○ Graphiti                 ○ Beliefs
     \                          \
      ◎                            ◎
     /                          /
  ○ RAG                       ○ Evidence
```

The purpose is **comparative cognition**, not split-screen note editing.

Potential operations:

- overlap detection
- A-only / B-only structure
- bridge discovery
- missing edge detection
- structural analogy
- contradiction/tension across fields
- shared assumptions

A future `☿ Compare Fields` operator can reason over two bounded field projections.

---

# 4. Temporal Fields

Because PCF preserves event history and timestamps, a future Field can also represent an idea at a particular time.

Example:

```text
AI MEMORY — March 2027
vs.
AI MEMORY — September 2027
```

Possible diff:

- new connections
- lost connections
- changed beliefs
- new evidence
- resolved questions
- new contradictions

This is a future **diff for thought** and validates keeping event history from v0.1 onward.

---

# 5. AI-Generated Lenses

A **Lens** answers:

> Which parts of my cognitive state satisfy this question?

A Field is anchored in an object. A Lens is anchored in a query.

The user speaks natural language:

> Show me unresolved ideas from the last six months that challenge something I currently believe about AI.

Claude should **interpret** the request but should not directly choose the result set.

Architecture:

```text
Natural language
      ↓
Claude
      ↓
Lens AST
      ↓
Schema validation
      ↓
Deterministic PCF query engine
      ↓
SQLite / graph traversal
      ↓
Results
```

Core principle:

> Claude interprets. PCF executes.

This keeps result membership inspectable and reproducible.

---

# 6. Future Lens AST

Illustrative only; do not implement in v0.1.

```ts
interface LensAst {
  scope: "objects" | "claims" | "relations";
  where: unknown;
  orderBy?: Array<{
    field: string;
    direction: "asc" | "desc";
  }>;
  limit?: number;
}
```

A future natural-language query might compile to deterministic constraints over:

- object type
- date/time
- status
- house vector
- concept membership
- relation type
- claim state
- activation
- feedback
- contradiction state
- relevance to an anchor

Saved Lenses should be ephemeral by default and persistent only when explicitly saved.

---

# 7. Field vs Lens

| | Field | Lens |
|---|---|---|
| Question | What surrounds this? | What satisfies this? |
| Root | CognitiveObject | Query |
| Discovery mode | Associative | Selective |
| Typical output | Constellation | Filtered projection |
| AI role | Help infer relevance/meaning | Compile intent into query AST |
| Execution | Ranked contextual projection | Deterministic query after compilation |
| Primary use | Exploration | Investigation |

They can later compose:

```text
Field(AI Memory)
       ↓
Lens("only unresolved assumptions")
       ↓
Filtered constellation
```

or:

```text
Freeze Field A
Freeze Field B
      ↓
Lens("show structural analogies")
      ↓
☿ Compare Fields
```

---

# 8. Product grammar

The emerging PCF grammar is:

> **Object = a unit of cognition**  
> **Time = when cognition exists or changes**  
> **Field = relational context around cognition**  
> **Lens = a rule for looking across cognition**  
> **Operator = a transformation applied to cognition**

This grammar is intentionally different from folders/pages/databases.

---

# 9. Foundation audit

| Foundation | Freeze/Parallel Fields | Lenses | v0.1 change? |
|---|---:|---:|---:|
| Stable CognitiveObject IDs | sufficient | sufficient | No |
| Object types | sufficient | sufficient | No |
| Concepts | sufficient | sufficient | No |
| House vectors | sufficient | sufficient | No |
| Typed relations | sufficient | sufficient | No |
| Claims | sufficient | sufficient | No |
| Events | especially valuable | useful | No |
| Feedback | useful | useful | No |
| created_at / last_activated_at | sufficient | sufficient | No |
| Operator history | sufficient | sufficient | No |
| View/projection state | additive later | — | No |
| Lens AST | — | additive later | No |

## Final architectural decision

**PCF v0.1 remains frozen.**

Do not modify `SPEC.md` to add Fields or Lenses during the initial build.
