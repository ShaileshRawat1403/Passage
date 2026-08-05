import { describe, it, expect } from "vitest";
import { WorkflowDefinition, WorkflowRun } from "../src/types/workflow";
import { deriveWorkspaceOverview, sortWorkflowsRecent, toOverviewItem } from "../src/domain/workspaceOverview";

const sampleWf1: WorkflowDefinition = {
  id: "wf-1",
  name: "Invoice Approval",
  version: "1.0.0",
  status: "published",
  initialStateId: "s1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
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
          id: "t1",
          sourceStateId: "s1",
          targetStateId: "s2",
          event: "NEXT",
        },
      ],
    },
    {
      id: "s2",
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

const sampleWf2: WorkflowDefinition = {
  id: "wf-2",
  name: "Broken Workflow",
  version: "1.1.0",
  status: "draft",
  initialStateId: "s1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-05T00:00:00.000Z",
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
          targetStateId: "non-existent-state",
          event: "GOTO_MISSING",
        },
      ],
    },
  ],
};

const sampleWf3: WorkflowDefinition = {
  id: "wf-3",
  name: "Warning Workflow",
  version: "2.0.0",
  status: "archived",
  initialStateId: "s1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
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
          id: "t-no-evt",
          sourceStateId: "s1",
          targetStateId: "s2",
          event: "", // warning: no trigger event
        },
      ],
    },
    {
      id: "s2",
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

describe("Workspace Overview Domain Derivation (P1.5)", () => {
  it("1. Active workflow becomes Continue Working", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1, sampleWf2],
      activeWorkflowId: "wf-1",
      activeRuns: [],
    });

    expect(overview.continueWorkflow).not.toBeNull();
    expect(overview.continueWorkflow?.workflowId).toBe("wf-1");
    expect(overview.continueWorkflow?.name).toBe("Invoice Approval");
  });

  it("2. Missing active workflow falls back to most recently updated", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1, sampleWf2], // wf-2 updatedAt is Jan 5, wf-1 is Jan 2
      activeWorkflowId: "non-existent",
      activeRuns: [],
    });

    expect(overview.continueWorkflow?.workflowId).toBe("wf-2");
  });

  it("3. No workflows produces a null continue item", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [],
      activeWorkflowId: null,
      activeRuns: [],
    });

    expect(overview.continueWorkflow).toBeNull();
    expect(overview.recentWorkflows).toEqual([]);
    expect(overview.counts.workflows).toBe(0);
  });

  it("4. Recent workflows sort by updatedAt descending", () => {
    const sorted = sortWorkflowsRecent([sampleWf1, sampleWf2, sampleWf3]);
    expect(sorted.map((w) => w.id)).toEqual(["wf-2", "wf-3", "wf-1"]);
  });

  it("5. Ties sort by workflow ID", () => {
    const wfA: WorkflowDefinition = { ...sampleWf1, id: "wf-alpha", updatedAt: "2026-01-01T00:00:00.000Z" };
    const wfB: WorkflowDefinition = { ...sampleWf1, id: "wf-beta", updatedAt: "2026-01-01T00:00:00.000Z" };

    const sorted = sortWorkflowsRecent([wfB, wfA]);
    expect(sorted.map((w) => w.id)).toEqual(["wf-alpha", "wf-beta"]);
  });

  it("6. Invalid dates sort after valid dates", () => {
    const wfValid: WorkflowDefinition = { ...sampleWf1, id: "valid", updatedAt: "2026-01-01T00:00:00.000Z" };
    const wfInvalid: WorkflowDefinition = { ...sampleWf1, id: "invalid", updatedAt: "not-a-date" };

    const sorted = sortWorkflowsRecent([wfInvalid, wfValid]);
    expect(sorted.map((w) => w.id)).toEqual(["valid", "invalid"]);
  });

  it("7. Recent workflows are capped at five", () => {
    const manyWfs: WorkflowDefinition[] = Array.from({ length: 10 }, (_, i) => ({
      ...sampleWf1,
      id: `wf-${i}`,
      name: `Wf ${i}`,
      updatedAt: `2026-01-${10 + i}T00:00:00.000Z`,
    }));

    const overview = deriveWorkspaceOverview({
      workflows: manyWfs,
      activeWorkflowId: "wf-0",
      activeRuns: [],
    });

    expect(overview.recentWorkflows.length).toBe(5);
  });

  it("8. Workflow arrays are not mutated", () => {
    const original = [sampleWf1, sampleWf2];
    const originalCopy = JSON.parse(JSON.stringify(original));

    deriveWorkspaceOverview({
      workflows: original,
      activeWorkflowId: "wf-1",
      activeRuns: [],
    });

    expect(original).toEqual(originalCopy);
  });

  it("9. Readiness comes from the authoritative readiness function", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1, sampleWf2],
      activeWorkflowId: null,
      activeRuns: [],
    });

    const item1 = overview.recentWorkflows.find((w) => w.workflowId === "wf-1");
    const item2 = overview.recentWorkflows.find((w) => w.workflowId === "wf-2");

    expect(item1?.readiness).toBe("executable");
    expect(item2?.readiness).toBe("incomplete");
  });

  it("10. Error and warning counts come from workflow validation", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1, sampleWf2, sampleWf3],
      activeWorkflowId: null,
      activeRuns: [],
    });

    const item1 = overview.recentWorkflows.find((w) => w.workflowId === "wf-1");
    const item2 = overview.recentWorkflows.find((w) => w.workflowId === "wf-2");
    const item3 = overview.recentWorkflows.find((w) => w.workflowId === "wf-3");

    expect(item1?.errorCount).toBe(0);
    expect(item2?.errorCount).toBeGreaterThan(0);
    expect(item3?.errorCount).toBe(0);
    expect(item3?.warningCount).toBeGreaterThan(0);
  });

  it("11. Workflows with errors create error attention items", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf2],
      activeWorkflowId: null,
      activeRuns: [],
    });

    const errItem = overview.attentionItems.find((a) => a.kind === "workflow_errors");
    expect(errItem).toBeDefined();
    expect(errItem?.severity).toBe("error");
    expect(errItem?.workflowId).toBe("wf-2");
  });

  it("12. Warning-only workflows create warning attention items", () => {
    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf3],
      activeWorkflowId: null,
      activeRuns: [],
    });

    const warnItem = overview.attentionItems.find((a) => a.kind === "workflow_warnings");
    expect(warnItem).toBeDefined();
    expect(warnItem?.severity).toBe("warning");
    expect(warnItem?.workflowId).toBe("wf-3");
  });

  it("13. Waiting runs create waiting attention items", () => {
    const runWaiting: WorkflowRun = {
      id: "RUN-WAIT-1",
      caseId: "CASE-WAIT-1",
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: "waiting",
      currentStateId: "s1",
      context: {},
      visitedStateIds: ["s1"],
      history: [],
      auditTrail: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      lastEventAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      failedActionCount: 0,
      completedActionCount: 0,
    };

    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1],
      activeWorkflowId: null,
      activeRuns: [runWaiting],
    });

    const item = overview.attentionItems.find((a) => a.kind === "waiting_run");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("warning");
    expect(item?.runId).toBe("RUN-WAIT-1");
  });

  it("14. Failed runs create failure attention items", () => {
    const runFailed: WorkflowRun = {
      id: "RUN-FAIL-1",
      caseId: "CASE-FAIL-1",
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: "failed",
      currentStateId: "s1",
      context: {},
      visitedStateIds: ["s1"],
      history: [],
      auditTrail: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      lastEventAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      failedActionCount: 1,
      completedActionCount: 0,
    };

    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1],
      activeWorkflowId: null,
      activeRuns: [runFailed],
    });

    const item = overview.attentionItems.find((a) => a.kind === "failed_run");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("error");
    expect(item?.runId).toBe("RUN-FAIL-1");
  });

  it("15. Attention ordering is deterministic", () => {
    const runFailed: WorkflowRun = {
      id: "RUN-FAIL-1",
      caseId: "CASE-FAIL-1",
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: "failed",
      currentStateId: "s1",
      context: {},
      visitedStateIds: ["s1"],
      history: [],
      auditTrail: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      lastEventAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      failedActionCount: 1,
      completedActionCount: 0,
    };

    const runWaiting: WorkflowRun = {
      id: "RUN-WAIT-1",
      caseId: "CASE-WAIT-1",
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: "waiting",
      currentStateId: "s1",
      context: {},
      visitedStateIds: ["s1"],
      history: [],
      auditTrail: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      lastEventAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      failedActionCount: 0,
      completedActionCount: 0,
    };

    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1, sampleWf2, sampleWf3],
      activeWorkflowId: null,
      activeRuns: [runWaiting, runFailed],
    });

    const kinds = overview.attentionItems.map((a) => a.kind);
    // Order should be: workflow_errors -> failed_run -> waiting_run -> workflow_warnings
    expect(kinds).toEqual([
      "workflow_errors",
      "failed_run",
      "waiting_run",
      "workflow_warnings",
    ]);
  });

  it("16. Counts are correctly derived", () => {
    const runWaiting: WorkflowRun = {
      id: "RUN-WAIT-1",
      caseId: "CASE-WAIT-1",
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: "waiting",
      currentStateId: "s1",
      context: {},
      visitedStateIds: ["s1"],
      history: [],
      auditTrail: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      lastEventAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      failedActionCount: 0,
      completedActionCount: 0,
    };

    const overview = deriveWorkspaceOverview({
      workflows: [sampleWf1, sampleWf2, sampleWf3],
      activeWorkflowId: null,
      activeRuns: [runWaiting],
    });

    expect(overview.counts.workflows).toBe(3);
    expect(overview.counts.drafts).toBe(1); // sampleWf2
    expect(overview.counts.executable).toBe(1); // sampleWf1
    expect(overview.counts.needingAttention).toBe(3); // wf2 err, runWait, wf3 warn
    expect(overview.counts.waitingRuns).toBe(1);
  });

  it("17. Archived status remains separate from readiness", () => {
    const item = toOverviewItem(sampleWf3);
    expect(item.lifecycleStatus).toBe("archived");
    expect(item.readiness).toBe("structurally_valid");
  });

  it("18. Derivation does not alter active runs or audit trails", () => {
    const run: WorkflowRun = {
      id: "RUN-TEST",
      caseId: "CASE-TEST",
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: "active",
      currentStateId: "s1",
      context: {},
      visitedStateIds: ["s1"],
      history: [],
      auditTrail: [{ id: "aud-1", workflowRunId: "RUN-TEST", workflowVersion: "1.0.0", stateId: "s1", eventType: "state_entered", timestamp: "2026-01-01T00:00:00.000Z" }],
      startedAt: "2026-01-01T00:00:00.000Z",
      lastEventAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      failedActionCount: 0,
      completedActionCount: 0,
    };

    const runCopy = JSON.parse(JSON.stringify(run));

    deriveWorkspaceOverview({
      workflows: [sampleWf1],
      activeWorkflowId: "wf-1",
      activeRuns: [run],
    });

    expect(run).toEqual(runCopy);
  });
});
