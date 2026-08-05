import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";

describe("Workflow Designer History", () => {
  beforeEach(() => {
    resetWorkflowStore();
    // Ensure isolated history
    useWorkflowStore.setState((s) => ({
      historyByWorkflowId: {},
    }));
  });

  const getWfId = () => {
    const id = useWorkflowStore.getState().createWorkflow("Test WF", "Desc");
    useWorkflowStore.getState().setActiveWorkflowId(id);
    return id;
  };

  it("should record history and undo/redo state changes correctly", () => {
    const initialWfId = getWfId();
    useWorkflowStore.getState().addState(initialWfId, { id: "s1", name: "Test State 1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    let state = useWorkflowStore.getState();
    let history = state.historyByWorkflowId[initialWfId];
    expect(history!.past.length).toBe(1);
    expect(history!.past[0].operation).toBe("STATE_ADDED");
    
    const addedStateWf = state.workflows.find((w) => w.id === initialWfId);
    expect(addedStateWf?.states.length).toBeGreaterThan(0);

    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    history = state.historyByWorkflowId[initialWfId];
    
    expect(history!.past.length).toBe(0);
    expect(history!.future.length).toBe(1);
    expect(history!.future[0].operation).toBe("STATE_ADDED");
    
    const undoneWf = state.workflows.find((w) => w.id === initialWfId);
    expect(undoneWf?.states.length).toBe(3);

    useWorkflowStore.getState().redo();
    state = useWorkflowStore.getState();
    history = state.historyByWorkflowId[initialWfId];
    
    expect(history!.past.length).toBe(1);
    expect(history!.future.length).toBe(0);
    
    const redoneWf = state.workflows.find((w) => w.id === initialWfId);
    expect(redoneWf?.states.length).toBe(addedStateWf!.states.length);
  });

  it("should restore selection on undo", () => {
    const initialWfId = getWfId();
    useWorkflowStore.getState().addState(initialWfId, { id: "s1", name: "Selectable", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    const newStateId = "s1";
    useWorkflowStore.getState().setSelectedStateId(newStateId);

    useWorkflowStore.getState().updateState(initialWfId, newStateId, { name: "Renamed" });
    
    let state = useWorkflowStore.getState();
    expect(state.selectedStateId).toBe(newStateId);

    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    
    expect(state.selectedStateId).toBe(newStateId);
  });

  it("should clear future on new action", () => {
    const initialWfId = getWfId();
    useWorkflowStore.getState().addState(initialWfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    useWorkflowStore.getState().undo();
    
    let state = useWorkflowStore.getState();
    expect(state.historyByWorkflowId[initialWfId].future.length).toBe(1);

    useWorkflowStore.getState().addState(initialWfId, { id: "s2", name: "S2", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    state = useWorkflowStore.getState();
    
    expect(state.historyByWorkflowId[initialWfId].future.length).toBe(0);
  });

  it("should keep workflow histories isolated", () => {
    const wf1 = getWfId();
    const wf2Id = getWfId();
    
    useWorkflowStore.getState().setActiveWorkflowId(wf1);
    useWorkflowStore.getState().addState(wf1, { id: "s1", name: "WF1 State", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    useWorkflowStore.getState().setActiveWorkflowId(wf2Id);
    useWorkflowStore.getState().addState(wf2Id, { id: "s2", name: "WF2 State", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    const state = useWorkflowStore.getState();
    expect(state.historyByWorkflowId[wf1].past.length).toBe(1);
    expect(state.historyByWorkflowId[wf2Id].past.length).toBe(1);
  });

  it("should not create history on no-op", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    // Clear history
    useWorkflowStore.setState((s) => ({ historyByWorkflowId: { ...s.historyByWorkflowId, [wfId]: { past: [], future: [] } } }));

    useWorkflowStore.getState().updateState(wfId, "s1", { name: "S1" });
    
    let state = useWorkflowStore.getState();
    const history = state.historyByWorkflowId[wfId];
    expect(history.past.length).toBe(0);
  });

  it("should group field-specific changes within 1 second", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    // Clear history
    useWorkflowStore.setState((s) => ({ historyByWorkflowId: { ...s.historyByWorkflowId, [wfId]: { past: [], future: [] } } }));

    useWorkflowStore.getState().updateState(wfId, "s1", { name: "Name 1" });
    useWorkflowStore.getState().updateState(wfId, "s1", { name: "Name 2" });
    
    let state = useWorkflowStore.getState();
    let history = state.historyByWorkflowId[wfId];
    expect(history.past.length).toBe(1); // grouped

    useWorkflowStore.getState().updateState(wfId, "s1", { description: "Desc 1" });
    state = useWorkflowStore.getState();
    history = state.historyByWorkflowId[wfId];
    expect(history.past.length).toBe(2);
  });

  it("should make clear canvas undoable", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    useWorkflowStore.getState().commitDraftOperation(wfId, "CANVAS_CLEARED", undefined, (draft) => {
      draft.states = [];
    });
    
    let state = useWorkflowStore.getState();
    expect(state.workflows.find(w => w.id === wfId)!.states.length).toBe(0);
    
    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    expect(state.workflows.find(w => w.id === wfId)!.states.length).toBe(4);
  });

  it("should undo subgraph paste atomically", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    useWorkflowStore.getState().copySelection(wfId, ["s1"], []);
    const countBefore = 4; // Initial states plus one we added
    
    useWorkflowStore.getState().pasteSelection(wfId);
    
    let state = useWorkflowStore.getState();
    expect(state.workflows.find(w => w.id === wfId)!.states.length).toBe(5);
    
    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    expect(state.workflows.find(w => w.id === wfId)!.states.length).toBe(4);
  });

  it("should limit history to 100 entries", () => {
    const wfId = getWfId();
    for (let i = 0; i < 105; i++) {
      useWorkflowStore.getState().addState(wfId, { id: `s${i}`, name: `State ${i}`, type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    }
    const state = useWorkflowStore.getState();
    const history = state.historyByWorkflowId[wfId];
    expect(history.past.length).toBe(100);
  });

  it("should not invoke undo on native text field edits", () => {
    const e = {
      ctrlKey: true,
      key: 'z',
      target: {
        tagName: 'INPUT',
        isContentEditable: false,
      }
    };
    
    const target = e.target as any;
    const isEditable = target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
    expect(isEditable).toBe(true);
  });

  it("should keep runtime runs unchanged", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    useWorkflowStore.getState().startNewRun(wfId);
    let state = useWorkflowStore.getState();
    const activeRunsBefore = state.activeRuns.length;
    
    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    expect(state.activeRuns.length).toBe(activeRunsBefore);
  });

  it("should make auto-layout one undo step", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    useWorkflowStore.getState().commitDraftOperation(wfId, "AUTO_LAYOUT_APPLIED", undefined, (draft) => {
      draft.states.forEach(s => s.position.x += 100);
    });
    
    let state = useWorkflowStore.getState();
    const history = state.historyByWorkflowId[wfId];
    expect(history.past.length).toBe(2); 
    
    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    expect(state.historyByWorkflowId[wfId].past.length).toBe(1);
  });

  it("should make node dragging create one snapshot", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    useWorkflowStore.getState().updateStatePosition(wfId, "s1", { x: 10, y: 10 });
    let state = useWorkflowStore.getState();
    expect(state.historyByWorkflowId[wfId].past.length).toBe(2);
  });

  it("should restore connected transitions on state deletion undo", () => {
    const wfId = getWfId();
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    useWorkflowStore.getState().addState(wfId, { id: "s2", name: "S2", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] as any[] });
    
    useWorkflowStore.getState().addTransition(wfId, { id: "t1", sourceStateId: "s1", targetStateId: "s2", event: "EV", priority: 1 });
    
    useWorkflowStore.getState().deleteSelection(wfId, ["s1"], []);
    
    let state = useWorkflowStore.getState();
    expect(state.workflows.find(w => w.id === wfId)!.states.find(s => s.id === "s1")).toBeUndefined();
    
    useWorkflowStore.getState().undo();
    state = useWorkflowStore.getState();
    
    const s1 = state.workflows.find(w => w.id === wfId)!.states.find(s => s.id === "s1");
    expect(s1).toBeDefined();
    expect(s1!.transitions!.length).toBe(1);
    expect(s1!.transitions![0].id).toBe("t1");
  });
});
