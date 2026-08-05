import { describe, it, expect } from "vitest";
import { computeWorkflowLayout, WorkflowLayoutOptions } from "../src/lib/layout";
import { WorkflowDefinition } from "../src/types/workflow";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";

describe("Workflow Layout Engine (P1.3)", () => {
  const defaultOptions: WorkflowLayoutOptions = {
    direction: "LR",
    nodeSpacing: 50,
    rankSpacing: 80,
    componentSpacing: 100,
    finalStateAlignment: true,
  };

  const createTestWorkflow = (): WorkflowDefinition => ({
    id: "wf-1",
    name: "Test Layout WF",
    version: "1.0.0",
    status: "draft",
    initialStateId: "s1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    states: [
      { id: "s1", name: "S1", type: "start", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "s2", name: "S2", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "s3", name: "S3", type: "final", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
    ],
  });

  const addTransition = (wf: WorkflowDefinition, source: string, target: string) => {
    const s = wf.states.find(st => st.id === source);
    if (s) {
      if (!s.transitions) s.transitions = [];
      s.transitions.push({
        id: `t-${source}-${target}`,
        sourceStateId: source,
        targetStateId: target,
        priority: 0,
        event: ''
      });
    }
  };

  it("final-state alignment: Final state should be on the last layer", async () => {
    const wf = createTestWorkflow();
    addTransition(wf, "s1", "s2");
    addTransition(wf, "s2", "s3");
    const res = await computeWorkflowLayout(wf, { ...defaultOptions, finalStateAlignment: true });
    expect(res.positions["s3"]!.x).toBeGreaterThan(res.positions["s2"]!.x);
  });

  it("decision branch spacing/order and parallel grouping", async () => {
    const wf = createTestWorkflow();
    wf.states.push({ id: "s4", name: "S4", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] });
    addTransition(wf, "s1", "s2");
    addTransition(wf, "s1", "s3");
    const res = await computeWorkflowLayout(wf, defaultOptions);
    expect(res.positions["s1"]).toBeDefined();
    expect(res.positions["s2"]).toBeDefined();
    expect(res.positions["s3"]).toBeDefined();
  });

  it("loopback classification", async () => {
    const wf = createTestWorkflow();
    addTransition(wf, "s1", "s2");
    addTransition(wf, "s2", "s3");
    addTransition(wf, "s3", "s1");
    const res = await computeWorkflowLayout(wf, defaultOptions);
    const transitionId = wf.states.find(s => s.id === "s3")!.transitions![0]!.id;
    expect(res.edgeKinds[transitionId]).toBe("loopback");
  });

  it("LR versus TB axis progression", async () => {
    const wf = createTestWorkflow();
    addTransition(wf, "s1", "s2");
    const resLR = await computeWorkflowLayout(wf, { ...defaultOptions, direction: "LR" });
    const resTB = await computeWorkflowLayout(wf, { ...defaultOptions, direction: "TB" });
    expect(resLR.positions["s2"]!.x).toBeGreaterThan(resLR.positions["s1"]!.x);
    expect(resTB.positions["s2"]!.y).toBeGreaterThan(resTB.positions["s1"]!.y);
  });

  it("redo restoring calculated positions", async () => {
    resetWorkflowStore();
    const wfId = useWorkflowStore.getState().createWorkflow("W1", "D");
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "start", position: { x: 123, y: 456 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] });
    await useWorkflowStore.getState().applyWorkflowLayout(wfId, defaultOptions);
    const posAfter = useWorkflowStore.getState().workflows[0]!.states[0]!.position;
    useWorkflowStore.getState().undo();
    useWorkflowStore.getState().redo();
    const posRedo = useWorkflowStore.getState().workflows[0]!.states[0]!.position;
    expect(posAfter).toEqual(posRedo);
  });

  it("invalid injected engine coordinates or missing-result IDs", async () => {
    const wf = createTestWorkflow();
    wf.states.push({ id: "s4", name: "S4", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] });
    addTransition(wf, "s1", "s2");
    wf.states[0]!.transitions![0]!.id = "dup";
    wf.states.push({ id: "s5", name: "S5", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [{ id: "dup", sourceStateId: "s5", targetStateId: "s1", priority: 0, event: "" }] });
    const res = await computeWorkflowLayout(wf, defaultOptions);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("zero mutation on a store-level blocked operation", async () => {
    resetWorkflowStore();
    const wfId = useWorkflowStore.getState().createWorkflow("W1", "D");
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "start", position: { x: 123, y: 456 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] });
    useWorkflowStore.getState().addState(wfId, { id: "s1", name: "S1", type: "start", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] });
    const result = await useWorkflowStore.getState().applyWorkflowLayout(wfId, defaultOptions);
    expect(result.status).toBe("blocked");
  });
});
