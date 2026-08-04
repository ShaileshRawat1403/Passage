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

* **Strict Zod Contract Boundaries**: Strict Zod schemas (`z.strictObject`) across all domain models rejecting unknown or unparsed properties at ingress.
* **Single Mandatory Ingress Parser**: `parseWorkflowDefinition()` handles normalization, strict schema validation, and deep semantic checks for all external workflow inputs.
* **Pure Deterministic Transition Planner**: Side-effect-free transition planning (`planTransition`) with deterministic guard evaluation and explicit ambiguity detection (rejects non-deterministic equal-priority transitions).
* **Fail-Closed Guard Evaluator**: Typed evaluation that fails closed (`passed: false`) if raw expressions cannot be parsed or evaluated safely.
* **Explicit Context Mapping Guarantee**: Actions strictly require declared `outputMapping` to update workflow context; unmapped action outputs remain solely in audit traces.
* **Injected Runtime Environment**: `RuntimeEnvironment` interface allows injecting fixed clock timestamps and deterministic ID generators for 100% reproducible test simulations.
* **Ordered Lifecycle Action Execution**: Action execution following standard state machine lifecycle order: `State Exit Actions` → `Transition Actions` → `Target State Entry Actions` → `Target State Active Actions`.
* **Immutable Run State Engine**: Side-effect-free run snapshot creation ensuring audit log integrity and state machine history predictability.
* **Visual State Machine Canvas & Inspector**: Drag-and-drop state canvas, transition edge inspector, guard condition builder, and simulation controls with multi-theme support.
* **Automated CI & Unit Testing**: Comprehensive Vitest suite (22 passing tests) and GitHub Actions CI workflow (`.github/workflows/ci.yml`).

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
