import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";
import { WorkflowDefinition, WorkflowState, ActionDefinition } from "../src/types/workflow";
import { getWorkflowReadiness } from "../src/domain/readiness";
import { cloneWorkflowSubgraph } from "../src/domain/clone";

describe("P1.1 Reliable Canvas Editing - Domain Operations & Invariants", () => {
  let testWorkflowId: string;

  beforeEach(() => {
    // Isolated store reset with deterministic ID factory
    resetWorkflowStore();
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

    // Newly pasted states are those not in the original 3 states
    const pastedStates = wfAfter.states.filter((s) => !["start-1", "step-1", "end-1"].includes(s.id));
    const pastedStart = pastedStates.find((s) => s.name.includes("Start State"));
    const pastedStep = pastedStates.find((s) => s.name.includes("Process Step"));

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

  it("8. Reject creating transitions with non-existent source or target endpoints", () => {
    const store = useWorkflowStore.getState();
    const wfBefore = store.workflows.find((w) => w.id === testWorkflowId)!;
    const initialTransitionsCount = wfBefore.states.reduce((acc, s) => acc + (s.transitions?.length || 0), 0);

    // Try adding a transition with missing target
    store.addTransition(testWorkflowId, {
      id: "tr-invalid-target",
      sourceStateId: "start-1",
      targetStateId: "non-existent-state-999",
      event: "BAD_ROUTE",
    });

    const wfAfter = useWorkflowStore.getState().workflows.find((w) => w.id === testWorkflowId)!;
    const transitionsCountAfter = wfAfter.states.reduce((acc, s) => acc + (s.transitions?.length || 0), 0);

    // Transition should be rejected and not present anywhere in the workflow
    expect(transitionsCountAfter).toBe(initialTransitionsCount);
    const startState = wfAfter.states.find((s) => s.id === "start-1")!;
    expect(startState.transitions.find((t) => t.id === "tr-invalid-target")).toBeUndefined();
  });

  it("9. Reject migrating transition source to a non-existent state", () => {
    const store = useWorkflowStore.getState();
    const wfBefore = store.workflows.find((w) => w.id === testWorkflowId)!;
    const startState = wfBefore.states.find((s) => s.id === "start-1")!;
    const originalTr = startState.transitions[0];
    expect(originalTr).toBeDefined();
    if (!originalTr) return;

    // Attempt to migrate source to non-existent state ID
    store.updateTransition(testWorkflowId, originalTr.id, {
      sourceStateId: "ghost-state-404",
    });

    const wfAfter = useWorkflowStore.getState().workflows.find((w) => w.id === testWorkflowId)!;
    const updatedStart = wfAfter.states.find((s) => s.id === "start-1")!;
    const trStillThere = updatedStart.transitions.find((t) => t.id === originalTr.id);

    // Transition source should remain unchanged
    expect(trStillThere).toBeDefined();
    expect(trStillThere?.sourceStateId).toBe("start-1");
  });

  it("10. Initial state deletion policy reassigns initialStateId cleanly", () => {
    const store = useWorkflowStore.getState();
    const wfBefore = store.workflows.find((w) => w.id === testWorkflowId)!;
    const initialId = wfBefore.initialStateId;

    // Delete the initial state ("start-1")
    store.deleteState(testWorkflowId, initialId);

    const wfAfter = useWorkflowStore.getState().workflows.find((w) => w.id === testWorkflowId)!;

    // Initial state ID should be reassigned to remaining start state or first state
    expect(wfAfter.initialStateId).not.toBe(initialId);
    expect(wfAfter.states.some((s) => s.id === wfAfter.initialStateId)).toBe(true);
  });

  it("11. Canvas edits do not modify an active WorkflowRun", () => {
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

  it("12. Readiness is derived separately from lifecycle status", () => {
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

  it("13. Domain multi-selection and selection reconciliation", () => {
    const store = useWorkflowStore.getState();

    store.setSelectedSelection(["start-1", "step-1"], ["tr-init"]);
    expect(useWorkflowStore.getState().selectedStateIds).toEqual(["start-1", "step-1"]);
    expect(useWorkflowStore.getState().selectedTransitionIds).toEqual(["tr-init"]);

    // Delete one of the selected states
    store.deleteState(testWorkflowId, "step-1");

    // Reconciled selection should automatically remove step-1
    const stateAfter = useWorkflowStore.getState();
    expect(stateAfter.selectedStateIds).not.toContain("step-1");
    expect(stateAfter.selectedStateIds).toContain("start-1");
  });

  it("14. Reject updating transition target to a non-existent state", () => {
    const store = useWorkflowStore.getState();
    const wfBefore = store.workflows.find((w) => w.id === testWorkflowId)!;
    const startState = wfBefore.states.find((s) => s.id === "start-1")!;
    const originalTr = startState.transitions[0]!;

    store.updateTransition(testWorkflowId, originalTr.id, {
      targetStateId: "missing-target-999",
    });

    const wfAfter = useWorkflowStore.getState().workflows.find((w) => w.id === testWorkflowId)!;
    const startAfter = wfAfter.states.find((s) => s.id === "start-1")!;
    const trAfter = startAfter.transitions.find((t) => t.id === originalTr.id)!;

    expect(trAfter.targetStateId).toBe(originalTr.targetStateId);
    expect(trAfter.targetStateId).not.toBe("missing-target-999");
  });

  it("15. Switching workflows clears stale multi-selection arrays", () => {
    useWorkflowStore.getState().setSelectedSelection(["start-1", "step-1"], ["tr-init"]);
    expect(useWorkflowStore.getState().selectedStateIds).toEqual(["start-1", "step-1"]);
    expect(useWorkflowStore.getState().selectedTransitionIds).toEqual(["tr-init"]);

    // Switch to another workflow
    const currentStore = useWorkflowStore.getState();
    const otherWf = currentStore.workflows.find((w) => w.id !== testWorkflowId)!;
    currentStore.setActiveWorkflowId(otherWf.id);

    const storeAfter = useWorkflowStore.getState();
    const expectedFirstState = otherWf.states[0]?.id;
    expect(storeAfter.activeWorkflowId).toBe(otherWf.id);
    expect(storeAfter.selectedStateIds).toEqual(expectedFirstState ? [expectedFirstState] : []);
    expect(storeAfter.selectedTransitionIds).toEqual([]);
  });

  it("16. Clone remapping preserves transition-action IDs, compensation, and parallel requiredActionIds", () => {
    const act1: ActionDefinition = {
      id: "act-orig-1",
      name: "Compensate Action",
      type: "function",
    };
    const act2: ActionDefinition = {
      id: "act-orig-2",
      name: "Main Action",
      type: "audit",
      compensationActionId: "act-orig-1",
    };

    const stateWithParallel: WorkflowState = {
      id: "st-parallel-1",
      name: "Parallel Node",
      type: "parallel",
      entryActions: [act1, act2],
      activeActions: [],
      exitActions: [],
      parallelPolicy: {
        mode: "all",
        requiredActionIds: ["act-orig-1", "act-orig-2"],
      },
      transitions: [],
    };

    const transitionWithAction = {
      id: "tr-act-1",
      sourceStateId: "st-parallel-1",
      targetStateId: "end-1",
      event: "NEXT",
      actions: [
        {
          id: "tr-act-orig",
          name: "Transition Log",
          type: "notification" as const,
        },
      ],
    };

    const { states: clonedStates, transitions: clonedTransitions } = cloneWorkflowSubgraph(
      [stateWithParallel],
      [transitionWithAction],
      { idGenerator: (prefix) => `${prefix}-clone-${Math.floor(Math.random() * 1000)}` }
    );

    expect(clonedStates.length).toBe(1);
    expect(clonedTransitions.length).toBe(1);

    const clonedState = clonedStates[0]!;
    const clonedAct1 = clonedState.entryActions[0]!;
    const clonedAct2 = clonedState.entryActions[1]!;

    expect(clonedAct1.id).not.toBe("act-orig-1");
    expect(clonedAct2.id).not.toBe("act-orig-2");

    // Compensation reference should point to cloned act1 ID
    expect(clonedAct2.compensationActionId).toBe(clonedAct1.id);

    // Parallel requiredActionIds should point to cloned action IDs
    expect(clonedState.parallelPolicy?.requiredActionIds).toEqual([clonedAct1.id, clonedAct2.id]);

    // Transition action ID should be remapped
    const clonedTr = clonedTransitions[0]!;
    expect(clonedTr.actions?.[0]?.id).toBeDefined();
    expect(clonedTr.actions?.[0]?.id).not.toBe("tr-act-orig");
  });

  it("17. Transition-only copying with multiple edges between same endpoints only copies selected edge", () => {
    const store = useWorkflowStore.getState();

    // Add a second transition between start-1 and step-1
    store.addTransition(testWorkflowId, {
      id: "tr-init-2",
      sourceStateId: "start-1",
      targetStateId: "step-1",
      event: "SECOND_EVENT",
    });

    // Copy transition-only passing transitionIds = ["tr-init"] without stateIds
    store.copySelection(testWorkflowId, [], ["tr-init"]);

    const clip = useWorkflowStore.getState().copiedSelection;
    expect(clip).toBeDefined();
    expect(clip?.transitions.length).toBe(1);
    expect(clip?.transitions[0]?.id).toBe("tr-init");

    // Paste in workspace
    store.pasteSelection(testWorkflowId);

    const wfAfter = useWorkflowStore.getState().workflows.find((w) => w.id === testWorkflowId)!;
    const pastedTransitions = wfAfter.states.flatMap((s) =>
      (s.transitions || []).filter((t) => t.event === "WORKFLOW_STARTED")
    );
    expect(pastedTransitions.length).toBe(2);
  });
});
