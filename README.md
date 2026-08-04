# Stateflow — Visual State Machine Workflow Designer & Execution Runtime

**Stateflow** is an enterprise visual workflow platform designed for business process owners and technical engineers. It combines the execution power of a DAG, the lifecycle clarity of a state machine, the expressiveness of statecharts, the durability of modern workflow runtimes, and the readability of business process maps.

---

## 🌟 Key Features

* **Visual State Machine Designer**: Drag, connect, and configure process states using understandable vocabulary (*states, events, decisions, transitions, actions, approvals, waiting, completion*).
* **Human-Readable Guards**: Visually build transition guards using logical condition groups (`ALL`, `ANY`, `NOT`) with operators (`equals`, `>`, `<`, `contains`, `is_true`), or write technical YAML expressions.
* **Deterministic Execution Engine**: Pure state machine runtime with event dispatching, priority-sorted transition evaluation, and state entry/active/exit action lifecycles.
* **Durable Waiting & Human Approvals**: Built-in SLA timeout policies, role assignments (e.g. Finance Manager), and human approval decisions (`APPROVE`, `REJECT`, `REQUEST_CHANGES`).
* **AI Natural Language Workflow Generator**: Integrated Gemini 3.6 Flash assistant to synthesize full state machine workflows from plain English descriptions.
* **Live Step-by-Step Simulator & Timeline**: Emit events, adjust context payloads, evaluate guards, and inspect append-only audit trails in real time.
* **Pre-Loaded Sample Workflows**: Includes *Vendor Invoice Review* (Vendor validation, >₹50,000 threshold decision, AI risk analyst agent, Finance approval, payment disbursement), *Research Claim Validation*, and more.

---

## 📐 Mental Model

```text
Current State
+ Event Trigger
+ Workflow Context Payload
+ Guard Evaluation
──────────────────────────────
Actions Executed
+ Context Updates
+ Next Target State
```

---

## 🚀 Quick Setup

### Prerequisites
* Node.js 18+

### Installation
```bash
# Install dependencies
npm install

# Start development server (Port 3000)
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

---

## 📂 Project Structure

```text
src/
├── types/
│   └── workflow.ts        # TypeScript domain models (WorkflowDefinition, WorkflowState, GuardDefinition, etc.)
├── domain/
│   ├── guardEvaluator.ts  # Guard expression and condition evaluator
│   ├── validation.ts      # Deterministic workflow validator
│   ├── runtime.ts         # Pure state machine execution engine
│   └── sampleWorkflows.ts # Seed workflows (Vendor Invoice Review)
├── store/
│   └── workflowStore.ts   # Zustand store for workflows, runs, and simulation
├── components/
│   ├── canvas/            # React Flow custom nodes (Start, Atomic, Decision, Parallel, Waiting, Approval, Final)
│   ├── inspector/         # State inspector, Guard builder, Action config modal
│   ├── runtime/           # Simulator toolbar, Live run timeline, Context inspector
│   ├── ai/                # Natural language AI workflow creator modal
│   └── views/             # Operational Dashboard, Workflow list, Connections, Governance settings
├── server.ts              # Express + Vite backend with Gemini AI endpoint
```

---

## 📝 License

Apache-2.0
