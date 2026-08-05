import { describe, it, expect } from "vitest";
import { WorkflowDefinition } from "../src/types/workflow";
import { deriveWorkspaceOverview } from "../src/domain/workspaceOverview";
import { createInitialTestStore, useWorkflowStore } from "../src/store/workflowStore";

const sampleWorkflow1: WorkflowDefinition = {
  id: "wf-1",
  name: "Invoice Processing",
  version: "1.0.0",
  status: "published",
  initialStateId: "start",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-10T00:00:00.000Z",
  states: [
    {
      id: "start",
      name: "Start",
      type: "start",
      position: { x: 0, y: 0 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "t1",
          sourceStateId: "start",
          targetStateId: "end",
          event: "SUBMIT",
        },
      ],
    },
    {
      id: "end",
      name: "Done",
      type: "final",
      position: { x: 100, y: 0 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },
  ],
};

const sampleWorkflow2: WorkflowDefinition = {
  id: "wf-2",
  name: "Employee Onboarding",
  version: "1.1.0",
  status: "draft",
  initialStateId: "s1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-15T00:00:00.000Z",
  states: [
    {
      id: "s1",
      name: "Start",
      type: "start",
      position: { x: 0, y: 0 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "t-invalid",
          sourceStateId: "s1",
          targetStateId: "missing-target",
          event: "GOTO",
        },
      ],
    },
  ],
};

describe("Passage Home Integration & Verification (P1.5)", () => {
  it("1. Default initial active tab is 'home'", () => {
    const store = createInitialTestStore();
    expect(store.activeTab).toBe("home");
  });

  it("2. Overview computes continueWorkflow using activeWorkflowId when valid", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWorkflow1, sampleWorkflow2],
      activeWorkflowId: "wf-1",
      activeRuns: [],
    });

    expect(overview.continueWorkflow).not.toBeNull();
    expect(overview.continueWorkflow?.workflowId).toBe("wf-1");
    expect(overview.continueWorkflow?.name).toBe("Invoice Processing");
    expect(overview.continueWorkflow?.readiness).toBe("executable");
  });

  it("3. Overview falls back to most recently updated workflow when activeWorkflowId is invalid", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWorkflow1, sampleWorkflow2], // wf-2 updatedAt Jan 15 > wf-1 Jan 10
      activeWorkflowId: "non-existent-wf",
      activeRuns: [],
    });

    expect(overview.continueWorkflow?.workflowId).toBe("wf-2");
    expect(overview.continueWorkflow?.readiness).toBe("incomplete");
  });

  it("4. Overview returns null continueWorkflow when no workflows exist", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [],
      activeWorkflowId: null,
      activeRuns: [],
    });

    expect(overview.continueWorkflow).toBeNull();
    expect(overview.counts.workflows).toBe(0);
    expect(overview.recentWorkflows).toEqual([]);
  });

  it("5. Recent workflows order by updatedAt descending and cap at 5", () => {
    const manyWorkflows: WorkflowDefinition[] = Array.from({ length: 8 }, (_, i) => ({
      ...sampleWorkflow1,
      id: `wf-bulk-${i}`,
      name: `Workflow ${i}`,
      updatedAt: `2026-01-${10 + i}T00:00:00.000Z`,
    }));

    const overview = deriveWorkspaceOverview({
      workflows: manyWorkflows,
      activeWorkflowId: null,
      activeRuns: [],
    });

    expect(overview.recentWorkflows.length).toBe(5);
    expect(overview.recentWorkflows[0].workflowId).toBe("wf-bulk-7");
    expect(overview.recentWorkflows[4].workflowId).toBe("wf-bulk-3");
  });

  it("6. Attention items categorize workflow errors, warnings, waiting runs, and failed runs", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWorkflow1, sampleWorkflow2],
      activeWorkflowId: null,
      activeRuns: [
        {
          id: "run-failed-1",
          workflowId: "wf-1",
          workflowVersion: "1.0.0",
          status: "failed",
          currentStateId: "start",
          context: {},
          visitedStateIds: ["start"],
          history: [],
          auditTrail: [],
          startedAt: "2026-01-01T00:00:00.000Z",
          lastEventAt: "2026-01-01T00:00:00.000Z",
          retryCount: 0,
          failedActionCount: 1,
          completedActionCount: 0,
        },
        {
          id: "run-waiting-1",
          workflowId: "wf-1",
          workflowVersion: "1.0.0",
          status: "waiting",
          currentStateId: "start",
          context: {},
          visitedStateIds: ["start"],
          history: [],
          auditTrail: [],
          startedAt: "2026-01-01T00:00:00.000Z",
          lastEventAt: "2026-01-01T00:00:00.000Z",
          retryCount: 0,
          failedActionCount: 0,
          completedActionCount: 0,
        },
      ],
    });

    expect(overview.attentionItems.length).toBeGreaterThanOrEqual(3);
    const kinds = overview.attentionItems.map((a) => a.kind);
    expect(kinds).toContain("workflow_errors");
    expect(kinds).toContain("failed_run");
    expect(kinds).toContain("waiting_run");
  });

  it("7. Workspace counts reflect current workflow and run totals accurately", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWorkflow1, sampleWorkflow2],
      activeWorkflowId: null,
      activeRuns: [
        {
          id: "run-act-1",
          workflowId: "wf-1",
          workflowVersion: "1.0.0",
          status: "active",
          currentStateId: "start",
          context: {},
          visitedStateIds: ["start"],
          history: [],
          auditTrail: [],
          startedAt: "2026-01-01T00:00:00.000Z",
          lastEventAt: "2026-01-01T00:00:00.000Z",
          retryCount: 0,
          failedActionCount: 0,
          completedActionCount: 0,
        },
      ],
    });

    expect(overview.counts.workflows).toBe(2);
    expect(overview.counts.drafts).toBe(1);
    expect(overview.counts.executable).toBe(1);
    expect(overview.counts.activeRuns).toBe(1);
  });

  it("8. Store creation adds a new workflow and updates activeWorkflowId and activeTab", () => {
    const initialCount = useWorkflowStore.getState().workflows.length;

    const newId = useWorkflowStore.getState().createWorkflow("New Onboarding Process", "Test Description");

    const state = useWorkflowStore.getState();
    expect(state.workflows.length).toBe(initialCount + 1);
    const created = state.workflows.find((w) => w.id === newId);
    expect(created).toBeDefined();
    expect(created?.name).toBe("New Onboarding Process");
    expect(created?.description).toBe("Test Description");
  });

  it("9. Store JSON import validates schema and adds workflow on success", () => {
    const validJson = JSON.stringify(sampleWorkflow1);

    const importedId = useWorkflowStore.getState().importWorkflowJson(validJson);
    const state = useWorkflowStore.getState();
    const imported = state.workflows.find((w) => w.id === importedId);

    expect(imported).toBeDefined();
    expect(imported?.name).toBe("Invoice Processing");
  });

  it("10. Store JSON import throws error on malformed or schema-invalid JSON", () => {
    const badJson = '{"name": "Invalid Json Workflow", "states": "not-an-array"}';

    expect(() => useWorkflowStore.getState().importWorkflowJson(badJson)).toThrow();
  });
});
