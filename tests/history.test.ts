import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";

describe("Workflow Designer History", () => {
  beforeEach(() => {
    resetWorkflowStore();
  });

  it("should record history and undo/redo state changes correctly", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows[0]!;
    const initialWfId = wf.id;

    store.setActiveWorkflowId(initialWfId);

    // Initial state
    let history = useWorkflowStore.getState().historyByWorkflowId[initialWfId];
    expect(history).toBeUndefined(); // No history yet

    // Perform an action
    useWorkflowStore.getState().addState(initialWfId, { name: "Test State 1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    // Check history
    let state = useWorkflowStore.getState();
    history = state.historyByWorkflowId[initialWfId];
    expect(history!.past.length).toBe(1);
    expect(history!.past[0].operation).toBe("STATE_ADDED");
    
    const addedStateWf = state.workflows.find((w) => w.id === initialWfId);
    expect(addedStateWf?.states.length).toBeGreaterThan(wf.states.length);

    // Undo
    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    history = state.historyByWorkflowId[initialWfId];
    
    expect(history!.past.length).toBe(0);
    expect(history!.future.length).toBe(1);
    expect(history!.future[0].operation).toBe("STATE_ADDED");
    
    const undoneWf = state.workflows.find((w) => w.id === initialWfId);
    expect(undoneWf?.states.length).toBe(wf.states.length);

    // Redo
    useWorkflowStore.getState().redo();
    state = useWorkflowStore.getState();
    history = state.historyByWorkflowId[initialWfId];
    
    expect(history!.past.length).toBe(1);
    expect(history!.future.length).toBe(0);
    
    const redoneWf = state.workflows.find((w) => w.id === initialWfId);
    expect(redoneWf?.states.length).toBe(addedStateWf!.states.length);
  });

  it("should restore selection on undo", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows[0]!;
    const initialWfId = wf.id;

    store.setActiveWorkflowId(initialWfId);
    
    // Add state to select
    useWorkflowStore.getState().addState(initialWfId, { name: "Selectable", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    const addedStateWf = useWorkflowStore.getState().workflows.find((w) => w.id === initialWfId)!;
    const newStateId = addedStateWf.states[addedStateWf.states.length - 1].id;

    useWorkflowStore.getState().setSelectedStateId(newStateId);

    // Perform an action while selected
    useWorkflowStore.getState().updateState(initialWfId, newStateId, { name: "Renamed" });
    
    let state = useWorkflowStore.getState();
    expect(state.selectedStateId).toBe(newStateId);

    // Undo
    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    
    expect(state.selectedStateId).toBe(newStateId); // Should restore selection
  });

  it("should clear future on new action", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows[0]!;
    const initialWfId = wf.id;

    store.setActiveWorkflowId(initialWfId);

    useWorkflowStore.getState().addState(initialWfId, { name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    useWorkflowStore.getState().undo();
    
    let state = useWorkflowStore.getState();
    expect(state.historyByWorkflowId[initialWfId].future.length).toBe(1);

    // New action should clear future
    useWorkflowStore.getState().addState(initialWfId, { name: "S2", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    state = useWorkflowStore.getState();
    
    expect(state.historyByWorkflowId[initialWfId].future.length).toBe(0);
  });

  it("should keep workflow histories isolated", () => {
    const store = useWorkflowStore.getState();
    const wf1 = store.workflows[0]!;
    
    // Create new workflow
    const wf2Id = useWorkflowStore.getState().createWorkflow("WF 2", "");
    
    // Switch to wf1 and do something
    useWorkflowStore.getState().setActiveWorkflowId(wf1!.id);
    useWorkflowStore.getState().addState(wf1!.id, { name: "WF1 State", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    // Switch to wf2 and do something
    useWorkflowStore.getState().setActiveWorkflowId(wf2Id);
    useWorkflowStore.getState().addState(wf2Id, { name: "WF2 State", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    const state = useWorkflowStore.getState();
    expect(state.historyByWorkflowId[wf1!.id].past.length).toBe(1);
    expect(state.historyByWorkflowId[wf2Id].past.length).toBe(1);
  });
});
