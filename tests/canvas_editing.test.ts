import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore } from "../src/store/workflowStore";
import { WorkflowDefinition, WorkflowState, ActionDefinition } from "../src/types/workflow";
import { getWorkflowReadiness } from "../src/domain/validation";

describe("P1.1 Reliable Canvas Editing - Domain Operations & Invariants", () => {
  let testWorkflowId: string;

  beforeEach(() => {
    // Reset store state with a clean test workflow
    const newId = useWorkflowStore.getState().createWorkflow("Test Canvas Workflow", "P1.1 Test");
    testWorkflowId = newId;
  });

  it("1. Connecting states creates one valid transition", () => {
    const store = useWorkflowStore.getState();
    const wfBefore = store.workflows.find((w) => w.id === testWorkflowId)!;
    const startState = wfBefore.states.find((s) => s.type === "start")!;
    const stepState = wfBefore.states.find((s) => s.type === "atomic")!;

    const initialTransitionCount = startState.transitions.length;

    store.addTransition(testWorkflowId, {
      id: "tr-test-connect",
      sourceStateId: startState.id,
      targetStateId: stepState.id,
      event: "TEST_CONNECT",
      priority: 5,
    });

    const storeAfter = useWorkflowStore.getState();
    const wfAfter = storeAfter.workflows.find((w) => w.id === testWorkflowId)!;
    const updatedStart = wfAfter.states.find((s) => s.id === startState.id)!;

    expect(updatedStart.transitions.length).toBe(initialTransitionCount + 1);
    const newTr = updatedStart.transitions.find((t) => t.id === "tr-test-connect");
    expect(newTr).toBeDefined();
    expect(newTr?.sourceStateId).toBe(startState.id);
    expect(newTr?.targetStateId).toBe(stepState.id);
    expect(newTr?.event).toBe("TEST_CONNECT");
    expect(storeAfter.selectedTransitionId).toBe("tr-test-connect");
  });

  it("2. Deleting a state removes incoming and outgoing transitions", () => {
    const store = useWorkflowStore.getState();
    const wfBefore = store.workflows.find((w) => w.id === testWorkflowId)!;
    const targetToDelete = wfBefore.states.find((s) => s.type === "atomic")!;

    store.deleteState(testWorkflowId, targetToDelete.id);

    const storeAfter = useWorkflowStore.getState();
    const wfAfter = storeAfter.workflows.find((w) => w.id === testWorkflowId)!;

    // Verify state is deleted
    expect(wfAfter.states.find((s) => s.id === targetToDelete.id)).toBeUndefined();

    // Verify no transition anywhere points to or originates from deleted state
    for (const st of wfAfter.states) {
      for (const tr of st.transitions || []) {
        expect(tr.sourceStateId).not.toBe(targetToDelete.id);
        expect(tr.targetStateId).not.toBe(targetToDelete.id);
      }
    }
  });

  it("3. Moving a state changes position only", () => {
    const store = useWorkflowStore.getState();
    const wfBefore = store.workflows.find((w) => w.id === testWorkflowId)!;
    const targetState = wfBefore.states[0]!;

    const oldActions = JSON.stringify(targetState.entryActions);
    const oldTransitions = JSON.stringify(targetState.transitions);

    store.updateStatePosition(testWorkflowId, targetState.id, { x: 550, y: 650 });

    const storeAfter = useWorkflowStore.getState();
    const wfAfter = storeAfter.workflows.find((w) => w.id === testWorkflowId)!;
    const movedState = wfAfter.states.find((s) => s.id === targetState.id)!;

    expect(movedState.position).toEqual({ x: 550, y: 650 });
    expect(JSON.stringify(movedState.entryActions)).toBe(oldActions);
    expect(JSON.stringify(movedState.transitions)).toBe(oldTransitions);
  });

  it("4. Duplicating a state generates new state and action IDs", () => {
    const store = useWorkflowStore.getState();

    // Add an action to a state first
    const testAction: ActionDefinition = {
      id: "act-original-1",
      name: "Test Action",
      type: "audit",
    };
    store.addActionToState(testWorkflowId, "step-1", "entry", testAction);

    store.duplicateState(testWorkflowId, "step-1");

    const storeAfter = useWorkflowStore.getState();
    const wfAfter = storeAfter.workflows.find((w) => w.id === testWorkflowId)!;
    const duplicateState = wfAfter.states.find((s) => s.id !== "step-1" && s.name.includes("Process Step"));

    expect(duplicateState).toBeDefined();
    expect(duplicateState?.id).not.toBe("step-1");
    expect(duplicateState?.position?.x).toBeGreaterThan(100);

    // Verify action IDs are remapped
    const dupAction = duplicateState?.entryActions[0];
    expect(dupAction).toBeDefined();
    expect(dupAction?.id).not.toBe("act-original-1");
    expect(storeAfter.selectedStateId).toBe(duplicateState?.id);
  });

  it("5. Copy/paste remaps internal transition references and excludes external targets", () => {
    const store = useWorkflowStore.getState();

    // Copy two states ("start-1" and "step-1") that have a transition between them
    store.copySelection(testWorkflowId, ["start-1", "step-1"], ["tr-init"]);
    store.pasteSelection(testWorkflowId, { x: 100, y: 100 });

    const storeAfter = useWorkflowStore.getState();
    const wfAfter = storeAfter.workflows.find((w) => w.id === testWorkflowId)!;

    // Check newly pasted states
    const pastedStart = wfAfter.states.find((s) => s.id.includes("start-1-paste"));
    const pastedStep = wfAfter.states.find((s) => s.id.includes("step-1-paste"));

    expect(pastedStart).toBeDefined();
    expect(pastedStep).toBeDefined();

    // Internal transition between pastedStart and pastedStep should exist with remapped IDs
    const internalTr = pastedStart?.transitions.find((t) => t.targetStateId === pastedStep?.id);
    expect(internalTr).toBeDefined();
    expect(internalTr?.sourceStateId).toBe(pastedStart?.id);
    expect(internalTr?.targetStateId).toBe(pastedStep?.id);
    expect(internalTr?.id).not.toBe("tr-init");
  });

  it("6. Dangling targets cannot be created through state deletion", () => {
    const store = useWorkflowStore.getState();
    store.deleteState(testWorkflowId, "end-1");

    const storeAfter = useWorkflowStore.getState();
    const wfAfter = storeAfter.workflows.find((w) => w.id === testWorkflowId)!;

    // All transitions pointing to end-1 must be purged
    for (const st of wfAfter.states) {
      for (const tr of st.transitions || []) {
        expect(tr.targetStateId).not.toBe("end-1");
      }
    }
  });

  it("7. Selection remains synchronized after deletion", () => {
    const store = useWorkflowStore.getState();
    store.setSelectedStateId("step-1");
    expect(useWorkflowStore.getState().selectedStateId).toBe("step-1");

    store.deleteState(testWorkflowId, "step-1");
    expect(useWorkflowStore.getState().selectedStateId).toBeNull();
  });

  it("8. Every edit triggers automatic validation", () => {
    const store = useWorkflowStore.getState();

    // Create an invalid transition pointing to a non-existent state
    store.addTransition(testWorkflowId, {
      id: "tr-invalid",
      sourceStateId: "start-1",
      targetStateId: "non-existent-state-999",
      event: "BAD_ROUTE",
    });

    const issues = useWorkflowStore.getState().validationIssues;
    const missingTargetIssue = issues.find((i) => i.id.includes("err-transition-missing-target"));
    expect(missingTargetIssue).toBeDefined();
    expect(missingTargetIssue?.severity).toBe("error");
  });

  it("9. Canvas edits do not modify an active WorkflowRun", () => {
    const store = useWorkflowStore.getState();
    const activeRun = store.startNewRun(testWorkflowId);

    const runStateBefore = activeRun.currentStateId;
    const runHistoryLengthBefore = activeRun.history.length;

    // Perform dramatic canvas modifications
    store.deleteState(testWorkflowId, "end-1");
    store.addState(testWorkflowId, {
      id: "new-atomic-99",
      name: "New Node",
      type: "atomic",
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    });

    const storeAfter = useWorkflowStore.getState();
    const runAfter = storeAfter.activeRuns.find((r) => r.id === activeRun.id)!;

    expect(runAfter.currentStateId).toBe(runStateBefore);
    expect(runAfter.history.length).toBe(runHistoryLengthBefore);
  });

  it("10. Readiness is derived separately from lifecycle status", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWorkflowId)!;

    expect(wf.status).toBe("draft");

    // Initially valid base workflow
    const readiness = getWorkflowReadiness(wf);
    expect(["structurally_valid", "executable"]).toContain(readiness);

    // Break the workflow structurally by removing all final states
    store.updateWorkflow(testWorkflowId, (draft) => {
      draft.states = draft.states.filter((s) => s.type !== "final");
    });

    const brokenWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWorkflowId)!;
    expect(brokenWf.status).toBe("draft");
    expect(getWorkflowReadiness(brokenWf)).toBe("incomplete");
  });
});
