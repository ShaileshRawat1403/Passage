# Milestone Specification: P1 — Serious Workflow Designer

**Milestone Status:** IN PROGRESS  
**Central Invariant:**  
> *"The designer may create incomplete drafts. Only the Passage contract boundary may declare them executable."*

---

## 1. Objective

Enable users to visually create, understand, repair, and simulate valid Passage workflows without directly manipulating or weakening the underlying execution contract.

---

## 2. Milestone Structure & Implementation Roadmap

```text
  P1.1 Reliable Canvas Editing
         │
         ▼
  P1.2 Undo & Redo System (Definition-level Snapshots)
         │
         ▼
  P1.3 Auto-Layout & Visual Hierarchy
         │
         ▼
  P1.4 Human-Readable Transition Editor
         │
         ▼
  P1.5 Structured Guard Builder & Explanation
         │
         ▼
  P1.6 Actionable Diagnostics with Canvas Focus
         │
         ▼
  P1.7 Derived Readiness Model (Draft → Valid → Executable → Published)
         │
         ▼
  P1.8 Guided Simulation Experience
```

---

## 3. Sub-Milestone Details

### P1.1 — Reliable Canvas Editing
- Drag & reposition states with position persistence.
- Create transitions by connecting handles.
- Safely delete states/transitions with automatic removal of dangling edges.
- Multi-select, copy/paste, state duplication, and keyboard shortcuts.
- Zoom, pan, fit-to-view controls.
- Synchronized selected-state and selected-transition UI state.

### P1.2 — Undo and Redo
- Definition-level snapshots storing workflow definitions, selection states, and timestamped operation descriptors (`STATE_ADDED`, `TRANSITION_UPDATED`, `AUTO_LAYOUT_APPLIED`, etc.).
- Excludes runtime runs, active simulation context, and audit logs.

### P1.3 — Auto-Layout and Visual Hierarchy
- Deterministic left-to-right / top-to-bottom layout algorithm.
- Decision-state routing, loopback separation, and start/final alignment.
- Undoable layout operations.

### P1.4 — Human-Readable Transition Editor
- Sentence-like transition representations ("WHEN event IF guard THEN target").
- Full control over event names, priorities, guards, and transition actions.
- Source/target synchronization.

### P1.5 — Structured Guard Builder
- ALL/ANY/NOT logical groups with typed operators and field path pickers.
- Human-readable guard evaluation explanations (e.g. *"Passed because invoice.amount (82,400) > 50,000"*).

### P1.6 — Interactive Diagnostics
- Actionable diagnostic issues linked to specific state/transition IDs.
- Focus affected state/transition on canvas upon clicking an issue.
- Clear distinction between structural warnings vs. contract errors.

### P1.7 — Readiness Model
- Four derived readiness tiers:
  1. `Draft`: Incomplete states or transitions permitted during editing.
  2. `Structurally Valid`: Passes schema & semantic validation rules.
  3. `Executable`: Complete action configurations, mappings, and connections.
  4. `Published`: Immutable executable snapshot.

### P1.8 — Simulation Experience
- Interactive stepping, event dispatching, payload configuration, and action failure simulation powered directly by the trusted local state machine kernel.

---

## 4. Scope Boundaries & Constraints

The following remain **strictly outside** P1 scope:
- External database persistence
- Distributed queues & durable background timers
- Real production API credentials
- Advanced parallel policies beyond `mode: "all"`
- Authentication / RBAC

All visual editing operates on draft definitions; execution is strictly guarded by `parseWorkflowDefinition()` and `validateWorkflow()`.
