# Passage — Human-Readable Workflow Orchestration

**Passage** is a deterministic, human-readable workflow orchestration platform designed to bridge business process intent and execution logic.

```text
Passage
Human-readable workflow orchestration
```

---

## 🏛️ Strategic Architecture

Passage separates workflow mechanics into four clean abstractions:

```text
State       → Where the process currently resides
Transition  → Why and when it may move
Action      → What performs the execution work
Evidence    → How every movement is proven (audit history)
```

---

## ⚙️ Implemented Capabilities (v0.1.0-alpha)

* **Schema Validation & Zod Contract**: Strict Zod schemas (`WorkflowDefinitionSchema`, `WorkflowStateSchema`, `TransitionDefinitionSchema`, `GuardDefinitionSchema`) guaranteeing schema integrity at import, AI generation, and runtime.
* **Pure Deterministic Transition Planner**: Side-effect-free transition planning (`planTransition`) with deterministic guard evaluation and explicit ambiguity detection (rejects non-deterministic equal-priority transitions).
* **Strict Typed Guard Evaluator**: Full typed evaluation supporting `equals`, `not_equals`, `greater_than`, `less_than`, `contains`, `matches_pattern`, `is_true`, `is_false`, `is_one_of` without string coercion bugs or unhandled operators.
* **Ordered Lifecycle Action Execution**: Action execution following standard state machine lifecycle order: `State Exit Actions` → `Transition Actions` → `Target State Entry Actions` → `Target State Active Actions`.
* **Explicit Action Input/Output Mapping**: Direct path-based context mapping (`inputMapping` and `outputMapping`) rather than arbitrary action-name heuristics.
* **Immutable Run State Engine**: Side-effect-free run snapshot creation ensuring audit log integrity and state machine history predictability.
* **Visual State Machine Canvas & Inspector**: Drag-and-drop state canvas, transition edge inspector, guard condition builder, and simulation controls.
* **Automated Unit Testing**: Comprehensive Vitest suite covering schema validation, guard evaluation, transition planning, ambiguity rejection, and run snapshots.

---

## 📌 Status & Roadmap

| Feature Layer | Status | Notes |
| :--- | :--- | :--- |
| **Zod Schema Contract** | ✅ Implemented | Source of truth for workflow definitions |
| **Deterministic Transition Planner** | ✅ Implemented | Pure planner with priority & ambiguity rules |
| **Local Simulation Runtime** | ✅ Implemented | In-memory deterministic simulator |
| **Unit Test Suite** | ✅ Implemented | `npm test` runs Vitest test runner |
| **Durable Run Persistence (DB)** | ⏳ Planned (P3) | SQLite/PostgreSQL append-only run store |
| **Distributed Worker Queue** | ⏳ Planned (P3) | External worker correlation & timer polling |

---

## 🚀 Development Setup

### Prerequisites
* Node.js 18+

### Commands
```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run linter / type checker
npm run lint

# Start development server (Port 3000)
npm run dev
```

---

## 📂 Project Structure

```text
src/
├── types/
│   └── workflow.ts        # Core TypeScript domain types
├── domain/
│   ├── schemas.ts         # Zod schemas for all domain entities
│   ├── validation.ts      # Deterministic workflow validator & Zod check
│   ├── guardEvaluator.ts  # Typed guard condition evaluator
│   ├── planner.ts         # Pure deterministic transition planner
│   ├── actionExecutor.ts  # Action resolution & explicit output mapper
│   ├── runtime.ts         # Immutable run snapshot reducer
│   ├── runtime.test.ts    # Vitest unit test suite
│   └── sampleWorkflows.ts # Seed workflows (e.g. Vendor Invoice Review)
├── store/
│   └── workflowStore.ts   # Zustand store for canvas and simulation state
├── components/            # Visual designer, canvas, inspector, and views
```

---

## 📝 License

Apache-2.0
