import { describe, it, expect, beforeEach } from "vitest";
import { computeWorkflowLayout, WorkflowLayoutOptions, WorkflowLayoutEngine } from "../src/lib/layout";
import { WorkflowDefinition } from "../src/types/workflow";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";
import { classifyWorkflowEdges } from "../src/lib/layout/classification";

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

  const addTransition = (wf: WorkflowDefinition, source: string, target: string, priority = 10, id?: string) => {
    const s = wf.states.find(st => st.id === source);
    if (s) {
      if (!s.transitions) s.transitions = [];
      s.transitions.push({
        id: id || `t-${source}-${target}`,
        sourceStateId: source,
        targetStateId: target,
        priority,
        event: 'NEXT',
      });
    }
  };

  beforeEach(() => {
    resetWorkflowStore();
  });

  it("final-state alignment: Final state should be positioned after preceding layers", async () => {
    const wf = createTestWorkflow();
    addTransition(wf, "s1", "s2");
    addTransition(wf, "s2", "s3");
    const res = await computeWorkflowLayout(wf, { ...defaultOptions, finalStateAlignment: true });
    expect(res.positions["s3"]!.x).toBeGreaterThan(res.positions["s2"]!.x);
    expect(res.positions["s2"]!.x).toBeGreaterThan(res.positions["s1"]!.x);
  });

  it("LR versus TB axis progression", async () => {
    const wf = createTestWorkflow();
    addTransition(wf, "s1", "s2");
    const resLR = await computeWorkflowLayout(wf, { ...defaultOptions, direction: "LR" });
    const resTB = await computeWorkflowLayout(wf, { ...defaultOptions, direction: "TB" });
    expect(resLR.positions["s2"]!.x).toBeGreaterThan(resLR.positions["s1"]!.x);
    expect(resTB.positions["s2"]!.y).toBeGreaterThan(resTB.positions["s1"]!.y);
  });

  it("decision branch priority ordering and parallel branch grouping", async () => {
    const wf = createTestWorkflow();
    wf.states = [
      { id: "s1", name: "Start", type: "start", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "dec", name: "Decision", type: "decision", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "branchHigh", name: "High Priority", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "branchLow", name: "Low Priority", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "join", name: "Join", type: "final", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
    ];
    addTransition(wf, "s1", "dec");
    addTransition(wf, "dec", "branchHigh", 100);
    addTransition(wf, "dec", "branchLow", 1);
    addTransition(wf, "branchHigh", "join");
    addTransition(wf, "branchLow", "join");

    const res = await computeWorkflowLayout(wf, defaultOptions);
    expect(res.positions["dec"]!.x).toBeGreaterThan(res.positions["s1"]!.x);
    expect(res.positions["branchHigh"]!.x).toBeGreaterThan(res.positions["dec"]!.x);
    expect(res.positions["branchLow"]!.x).toBeGreaterThan(res.positions["dec"]!.x);
    expect(res.positions["join"]!.x).toBeGreaterThan(res.positions["branchHigh"]!.x);

    const kinds = classifyWorkflowEdges(wf);
    expect(kinds["t-dec-branchHigh"]).toBe("branch");
    expect(kinds["t-dec-branchLow"]).toBe("branch");
  });

  it("edge classification determinism and self-loop / loopback detection", async () => {
    const wf = createTestWorkflow();
    addTransition(wf, "s1", "s2");
    addTransition(wf, "s2", "s3");
    addTransition(wf, "s3", "s1"); // Loopback
    addTransition(wf, "s2", "s2", 10, "t-s2-self"); // Self loop

    const res = await computeWorkflowLayout(wf, defaultOptions);
    expect(res.edgeKinds["t-s3-s1"]).toBe("loopback");
    expect(res.edgeKinds["t-s2-self"]).toBe("self_loop");
  });

  it("state-array and transition-array ordering independence", async () => {
    const wf1 = createTestWorkflow();
    addTransition(wf1, "s1", "s2");
    addTransition(wf1, "s2", "s3");

    const wf2: WorkflowDefinition = {
      ...wf1,
      states: [...wf1.states].reverse().map(st => ({
        ...st,
        transitions: st.transitions ? [...st.transitions].reverse() : [],
      })),
    };

    const res1 = await computeWorkflowLayout(wf1, defaultOptions);
    const res2 = await computeWorkflowLayout(wf2, defaultOptions);

    expect(res1.positions).toEqual(res2.positions);
    expect(res1.edgeKinds).toEqual(res2.edgeKinds);
  });

  it("node-overlap prevention on generated coordinates", async () => {
    const wf = createTestWorkflow();
    addTransition(wf, "s1", "s2");
    addTransition(wf, "s1", "s3");
    const res = await computeWorkflowLayout(wf, defaultOptions);

    const posList = Object.values(res.positions);
    for (let i = 0; i < posList.length; i++) {
      for (let j = i + 1; j < posList.length; j++) {
        const p1 = posList[i]!;
        const p2 = posList[j]!;
        const samePos = p1.x === p2.x && p1.y === p2.y;
        expect(samePos).toBe(false);
      }
    }
  });

  it("disconnected-component non-overlap and isolated-state stability", async () => {
    const wf = createTestWorkflow();
    wf.states.push(
      { id: "s4", name: "S4", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "s5", name: "S5", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] },
      { id: "iso", name: "Isolated", type: "atomic", position: { x: 0, y: 0 }, entryActions: [], activeActions: [], exitActions: [], transitions: [] }
    );
    addTransition(wf, "s1", "s2");
    addTransition(wf, "s4", "s5");

    const res = await computeWorkflowLayout(wf, defaultOptions);
    expect(res.positions["iso"]).toBeDefined();
    expect(res.positions["s4"]).toBeDefined();
    expect(res.positions["s5"]).toBeDefined();
    expect(res.warnings).toHaveLength(0);
  });

  it("semantic isolation: layout preserves all state properties except position and updatedAt", async () => {
    resetWorkflowStore();
    const wfId = useWorkflowStore.getState().createWorkflow("W1", "Desc");
    useWorkflowStore.getState().addState(wfId, {
      id: "s-custom",
      name: "Custom State Name",
      type: "atomic",
      position: { x: 0, y: 0 },
      entryActions: [{ id: "a1", name: "Audit Action", type: "audit" }],
      activeActions: [],
      exitActions: [],
      transitions: [],
    });

    const getWf = () => useWorkflowStore.getState().workflows.find(w => w.id === wfId)!;
    const initialActions = getWf().states.find(s => s.id === "s-custom")!.entryActions;

    await useWorkflowStore.getState().applyWorkflowLayout(wfId, defaultOptions);

    const wfAfter = getWf();
    const customStateAfter = wfAfter.states.find(s => s.id === "s-custom")!;
    expect(customStateAfter.name).toBe("Custom State Name");
    expect(customStateAfter.entryActions).toEqual(initialActions);
  });

  it("redo restoring calculated positions by finding exact wfId", async () => {
    resetWorkflowStore();
    const wfId = useWorkflowStore.getState().createWorkflow("W1", "D");
    const getWf = () => useWorkflowStore.getState().workflows.find(w => w.id === wfId)!;

    const posBeforeLayout = getWf().states.map(s => ({ id: s.id, position: { ...s.position } }));

    const layoutRes = await useWorkflowStore.getState().applyWorkflowLayout(wfId, defaultOptions);
    expect(layoutRes.status).toBe("applied");

    const posAfterLayout = getWf().states.map(s => ({ id: s.id, position: { ...s.position } }));

    // Undo should restore pre-layout positions
    useWorkflowStore.getState().undo();
    const posAfterUndo = getWf().states.map(s => ({ id: s.id, position: { ...s.position } }));
    expect(posAfterUndo).toEqual(posBeforeLayout);

    // Redo should re-apply auto-layout positions
    useWorkflowStore.getState().redo();
    const posAfterRedo = getWf().states.map(s => ({ id: s.id, position: { ...s.position } }));
    expect(posAfterRedo).toEqual(posAfterLayout);
  });

  it("repeated-layout no-op history (unchanged status)", async () => {
    resetWorkflowStore();
    const wfId = useWorkflowStore.getState().createWorkflow("W1", "D");

    const firstRes = await useWorkflowStore.getState().applyWorkflowLayout(wfId, defaultOptions);
    expect(firstRes.status).toBe("applied");

    const secondRes = await useWorkflowStore.getState().applyWorkflowLayout(wfId, defaultOptions);
    expect(secondRes.status).toBe("unchanged");
  });

  it("zero mutation on store-level blocked operation", async () => {
    resetWorkflowStore();
    const wfId = useWorkflowStore.getState().createWorkflow("W1", "D");
    const currentWf = useWorkflowStore.getState().workflows.find(w => w.id === wfId)!;

    // Inject duplicate state manually to test store-level validation blockage
    currentWf.states.push({
      id: "step-1", // duplicate of existing step-1
      name: "Duplicate Step",
      type: "atomic",
      position: { x: 0, y: 0 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    });

    const result = await useWorkflowStore.getState().applyWorkflowLayout(wfId, defaultOptions);
    expect(result.status).toBe("blocked");
    expect(result.warnings.some(w => w.code === "DUPLICATE_STATE_ID")).toBe(true);
  });

  it("invalid injected engine coordinates (NaN/Infinity) or missing/unknown IDs", async () => {
    const wf = createTestWorkflow();

    // Fake engine returning NaN coordinates
    const nanEngine: WorkflowLayoutEngine = {
      async layout() {
        return {
          positions: { s1: { x: NaN, y: 100 } },
          edgeKinds: {},
          warnings: [{ code: "INVALID_COORDINATES", message: "Invalid coordinates" }],
        };
      }
    };

    const resNaN = await computeWorkflowLayout(wf, defaultOptions, nanEngine);
    expect(resNaN.warnings.some(w => w.code === "INVALID_COORDINATES")).toBe(true);

    // Fake engine returning unknown state ID
    const unknownEngine: WorkflowLayoutEngine = {
      async layout() {
        return {
          positions: { s1: { x: 0, y: 0 }, unknownState: { x: 10, y: 10 } },
          edgeKinds: {},
          warnings: [{ code: "UNKNOWN_STATE_ID", message: "Unknown state ID" }],
        };
      }
    };

    const resUnknown = await computeWorkflowLayout(wf, defaultOptions, unknownEngine);
    expect(resUnknown.warnings.some(w => w.code === "UNKNOWN_STATE_ID")).toBe(true);

    // Fake engine returning missing state result
    const missingEngine: WorkflowLayoutEngine = {
      async layout() {
        return {
          positions: { s1: { x: 0, y: 0 } },
          edgeKinds: {},
          warnings: [{ code: "MISSING_RESULT", message: "Missing result for states" }],
        };
      }
    };

    const resMissing = await computeWorkflowLayout(wf, defaultOptions, missingEngine);
    expect(resMissing.warnings.some(w => w.code === "MISSING_RESULT")).toBe(true);
  });
});
