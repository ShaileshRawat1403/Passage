import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";
import { WorkflowDefinition, TransitionDefinition } from "../src/types/workflow";
import { describeTransition, formatGuard, formatConditionRule } from "../src/domain/transitionFormatter";
import { validateWorkflow } from "../src/domain/validation";
import { classifyWorkflowEdges } from "../src/lib/layout/classification";
import { createWorkflowRun } from "../src/domain/runtime";

describe("P1.4 — Human-Readable Transition Editor", () => {
  let testWfId: string;

  beforeEach(() => {
    resetWorkflowStore();
    const store = useWorkflowStore.getState();
    testWfId = store.createWorkflow("P1.4 Test Workflow", "Testing Human-Readable Transition Editor");
  });

  it("1. Human-readable summary resolves source and target names", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;

    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.updateState(testWfId, startState.id, { name: "Validate Invoice" });
    store.updateState(testWfId, atomicState.id, { name: "Manual Review" });

    store.addTransition(testWfId, {
      id: "tr-test-1",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "INVOICE_VALIDATED",
      priority: 100,
    });

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    const tr = updatedWf.states
      .flatMap((s) => s.transitions)
      .find((t) => t.id === "tr-test-1")!;

    const desc = describeTransition(tr, updatedWf);

    expect(desc.sourceLabel).toBe("Validate Invoice");
    expect(desc.targetLabel).toBe("Manual Review");
    expect(desc.eventLabel).toBe("INVOICE_VALIDATED");
    expect(desc.priorityLabel).toBe("Priority 100");
    expect(desc.headline).toContain("When INVOICE_VALIDATED occurs move from Validate Invoice to Manual Review Priority 100");
  });

  it("2. Missing state references produce safe fallback text", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;

    const trMissing: TransitionDefinition = {
      id: "tr-missing",
      sourceStateId: "missing-src-id",
      targetStateId: "missing-tgt-id",
      event: "ORPHAN_EVENT",
      priority: 10,
    };

    const desc = describeTransition(trMissing, wf);

    expect(desc.sourceLabel).toContain("missing-src-id");
    expect(desc.targetLabel).toContain("missing-tgt-id");
    expect(desc.headline).toContain("move from Unknown State (missing-src-id) to Unknown State (missing-tgt-id)");
  });

  it("3. ALL guard conditions produce deterministic readable text", () => {
    const tr: TransitionDefinition = {
      id: "tr-guard-all",
      sourceStateId: "st-1",
      targetStateId: "st-2",
      event: "SUBMIT",
      priority: 10,
      guard: {
        id: "g-1",
        name: "Check Amount and Vendor",
        logic: "ALL",
        conditions: [
          { id: "c-1", field: "Invoice amount", operator: "greater_than", value: 1000 },
          { id: "c-2", field: "Vendor status", operator: "is_true" },
        ],
      },
    };

    const summary = formatGuard(tr.guard);
    expect(summary).toBe("Invoice amount is greater than 1000 AND Vendor status is true");
  });

  it("4. ANY and NOT guards are described correctly", () => {
    const guardAny = {
      id: "g-any",
      name: "Either condition",
      logic: "ANY" as const,
      conditions: [
        { id: "c-1", field: "Is VIP", operator: "is_true" as const },
        { id: "c-2", field: "Score", operator: "greater_than" as const, value: 80 },
      ],
    };

    const summaryAny = formatGuard(guardAny);
    expect(summaryAny).toBe("Is VIP is true OR Score is greater than 80");

    const guardNot = {
      id: "g-not",
      name: "Not blacklisted",
      logic: "NOT" as const,
      conditions: [{ id: "c-1", field: "Is Blacklisted", operator: "is_true" as const }],
    };

    const summaryNot = formatGuard(guardNot);
    expect(summaryNot).toBe("NOT (Is Blacklisted is true)");
  });

  it("5. An unguarded route is described accurately", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;

    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    const tr: TransitionDefinition = {
      id: "tr-unguarded",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "DEFAULT_NEXT",
      priority: 10,
    };

    const desc = describeTransition(tr, wf);

    expect(desc.guardSummary).toBeNull();
    expect(desc.headline).toBe(`When DEFAULT_NEXT occurs move from ${startState.name} to ${atomicState.name} Priority 10`);
  });

  it("6. Updating an event preserves all unrelated transition fields", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "tr-preserve-fields",
      name: "Original Route Name",
      description: "Original Description",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "OLD_EVENT",
      priority: 42,
      type: "internal",
      actions: [{ id: "act-1", name: "Audit Log", type: "audit" }],
      guard: {
        id: "g-p",
        name: "Test Guard",
        logic: "ALL",
        conditions: [{ id: "c-p", field: "age", operator: "greater_than", value: 18 }],
      },
    });

    store.updateTransition(testWfId, "tr-preserve-fields", { event: "NEW_EVENT" });

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    const updatedTr = updatedWf.states
      .flatMap((s) => s.transitions)
      .find((t) => t.id === "tr-preserve-fields")!;

    expect(updatedTr.event).toBe("NEW_EVENT");
    expect(updatedTr.name).toBe("Original Route Name");
    expect(updatedTr.description).toBe("Original Description");
    expect(updatedTr.priority).toBe(42);
    expect(updatedTr.type).toBe("internal");
    expect(updatedTr.actions).toHaveLength(1);
    expect(updatedTr.guard?.name).toBe("Test Guard");
  });

  it("7. Updating a target preserves the transition ID", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const finalState = wf.states.find((s) => s.type === "final")!;

    store.addTransition(testWfId, {
      id: "tr-target-preserve",
      sourceStateId: startState.id,
      targetStateId: finalState.id,
      event: "GOTO_FINAL",
    });

    store.updateTransition(testWfId, "tr-target-preserve", { targetStateId: startState.id });

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    const tr = updatedWf.states
      .flatMap((s) => s.transitions)
      .find((t) => t.id === "tr-target-preserve")!;

    expect(tr).toBeDefined();
    expect(tr.id).toBe("tr-target-preserve");
    expect(tr.targetStateId).toBe(startState.id);
  });

  it("8. Moving a source relocates the transition exactly once", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;
    const finalState = wf.states.find((s) => s.type === "final")!;

    store.addTransition(testWfId, {
      id: "tr-move-source",
      sourceStateId: startState.id,
      targetStateId: finalState.id,
      event: "RELOCATE_EVENT",
    });

    store.moveTransitionSource(testWfId, "tr-move-source", atomicState.id);

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;

    const oldSourceState = updatedWf.states.find((s) => s.id === startState.id)!;
    const newSourceState = updatedWf.states.find((s) => s.id === atomicState.id)!;

    expect(oldSourceState.transitions.find((t) => t.id === "tr-move-source")).toBeUndefined();
    expect(newSourceState.transitions.find((t) => t.id === "tr-move-source")).toBeDefined();

    const totalOccurrences = updatedWf.states
      .flatMap((s) => s.transitions)
      .filter((t) => t.id === "tr-move-source").length;

    expect(totalOccurrences).toBe(1);
  });

  it("9. Source movement preserves guard, actions, priority and type", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;
    const finalState = wf.states.find((s) => s.type === "final")!;

    store.addTransition(testWfId, {
      id: "tr-move-full-meta",
      sourceStateId: startState.id,
      targetStateId: finalState.id,
      event: "FULL_META_EVENT",
      priority: 88,
      type: "internal",
      actions: [{ id: "a-1", name: "Notify Admin", type: "audit" }],
      guard: {
        id: "g-full",
        name: "Full Meta Guard",
        logic: "ALL",
        conditions: [{ id: "c-1", field: "active", operator: "is_true" }],
      },
    });

    store.moveTransitionSource(testWfId, "tr-move-full-meta", atomicState.id);

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    const movedTr = updatedWf.states
      .flatMap((s) => s.transitions)
      .find((t) => t.id === "tr-move-full-meta")!;

    expect(movedTr.sourceStateId).toBe(atomicState.id);
    expect(movedTr.priority).toBe(88);
    expect(movedTr.type).toBe("internal");
    expect(movedTr.actions).toHaveLength(1);
    expect(movedTr.guard?.name).toBe("Full Meta Guard");
  });

  it("10. Source movement is reversible through undo and redo", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;
    const finalState = wf.states.find((s) => s.type === "final")!;

    store.addTransition(testWfId, {
      id: "tr-undo-move",
      sourceStateId: startState.id,
      targetStateId: finalState.id,
      event: "UNDO_MOVE_EVENT",
    });

    store.moveTransitionSource(testWfId, "tr-undo-move", atomicState.id);

    // Verify moved
    let currentWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    expect(currentWf.states.find((s) => s.id === atomicState.id)?.transitions.some((t) => t.id === "tr-undo-move")).toBe(true);

    // Undo move
    useWorkflowStore.getState().undo();
    currentWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    expect(currentWf.states.find((s) => s.id === startState.id)?.transitions.some((t) => t.id === "tr-undo-move")).toBe(true);

    // Redo move
    useWorkflowStore.getState().redo();
    currentWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    expect(currentWf.states.find((s) => s.id === atomicState.id)?.transitions.some((t) => t.id === "tr-undo-move")).toBe(true);
  });

  it("11. Target editing is reversible", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;
    const finalState = wf.states.find((s) => s.type === "final")!;

    store.addTransition(testWfId, {
      id: "tr-undo-target",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "TARGET_CHANGE",
    });

    store.updateTransition(testWfId, "tr-undo-target", { targetStateId: finalState.id });

    let currentWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    let tr = currentWf.states.flatMap((s) => s.transitions).find((t) => t.id === "tr-undo-target")!;
    expect(tr.targetStateId).toBe(finalState.id);

    // Undo
    useWorkflowStore.getState().undo();
    currentWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    tr = currentWf.states.flatMap((s) => s.transitions).find((t) => t.id === "tr-undo-target")!;
    expect(tr.targetStateId).toBe(atomicState.id);

    // Redo
    useWorkflowStore.getState().redo();
    currentWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    tr = currentWf.states.flatMap((s) => s.transitions).find((t) => t.id === "tr-undo-target")!;
    expect(tr.targetStateId).toBe(finalState.id);
  });

  it("12. No-op edits create no history", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;

    const existingTr = startState.transitions[0];
    expect(existingTr).toBeDefined();
    if (!existingTr) return;

    const historyBefore = useWorkflowStore.getState().historyByWorkflowId[testWfId]?.past.length || 0;

    // No-op edit with same event
    store.updateTransition(testWfId, existingTr.id, { event: existingTr.event });

    const historyAfter = useWorkflowStore.getState().historyByWorkflowId[testWfId]?.past.length || 0;
    expect(historyAfter).toBe(historyBefore);
  });

  it("13. Field-specific edits create separate history operations", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "tr-sep-history",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "EVENT_A",
    });

    const hBase = useWorkflowStore.getState().historyByWorkflowId[testWfId]?.past.length || 0;

    store.updateTransition(testWfId, "tr-sep-history", { event: "EVENT_B" });
    const h1 = useWorkflowStore.getState().historyByWorkflowId[testWfId]?.past.length || 0;

    store.updateTransition(testWfId, "tr-sep-history", { targetStateId: startState.id });
    const h2 = useWorkflowStore.getState().historyByWorkflowId[testWfId]?.past.length || 0;

    expect(h1).toBe(hBase + 1);
    expect(h2).toBe(hBase + 2);

    // Undo target edit
    useWorkflowStore.getState().undo();
    let currentWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    let tr = currentWf.states.flatMap((s) => s.transitions).find((t) => t.id === "tr-sep-history")!;
    expect(tr.targetStateId).toBe(atomicState.id);
    expect(tr.event).toBe("EVENT_B"); // event edit still intact!
  });

  it("14. Transition selection survives valid edits", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "tr-select-survive",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "SEL_EVENT",
    });

    store.setSelectedTransitionId("tr-select-survive");
    expect(useWorkflowStore.getState().selectedTransitionId).toBe("tr-select-survive");

    store.updateTransition(testWfId, "tr-select-survive", { event: "SEL_UPDATED" });
    expect(useWorkflowStore.getState().selectedTransitionId).toBe("tr-select-survive");

    store.moveTransitionSource(testWfId, "tr-select-survive", atomicState.id);
    expect(useWorkflowStore.getState().selectedTransitionId).toBe("tr-select-survive");
  });

  it("15. Deletion clears invalid selection", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "tr-to-del",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "DEL_EVENT",
    });

    store.setSelectedTransitionId("tr-to-del");
    expect(useWorkflowStore.getState().selectedTransitionId).toBe("tr-to-del");

    store.deleteTransition(testWfId, "tr-to-del");
    expect(useWorkflowStore.getState().selectedTransitionId).toBeNull();
  });

  it("16. Validation issues are filtered by transitionId", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;

    // Directly insert transition with invalid target into state definition
    startState.transitions.push({
      id: "tr-invalid-target",
      sourceStateId: startState.id,
      targetStateId: "non-existent-state-id",
      event: "BAD_TARGET",
      priority: 10,
    });

    const issues = validateWorkflow(wf);
    const filteredForTr = issues.filter((i) => i.transitionId === "tr-invalid-target");

    expect(filteredForTr.length).toBeGreaterThan(0);
    expect(filteredForTr[0]?.message).toContain("non-existent target state");
  });

  it("17. Priority 0 is preserved and displayed", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "tr-prio-zero",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "ZERO_PRIO_EVENT",
      priority: 10,
    });

    store.updateTransition(testWfId, "tr-prio-zero", { priority: 0 });

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    const tr = updatedWf.states.flatMap((s) => s.transitions).find((t) => t.id === "tr-prio-zero")!;

    expect(tr.priority).toBe(0);

    const desc = describeTransition(tr, updatedWf);
    expect(desc.priorityLabel).toBe("Priority 0");
  });

  it("18. Route summaries remain independent of state-array ordering", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    const tr: TransitionDefinition = {
      id: "tr-order-indep",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "ORDER_INDEP_EVENT",
      priority: 25,
    };

    const descOriginal = describeTransition(tr, wf);

    // Create workflow with reversed states order
    const reversedWf: WorkflowDefinition = {
      ...wf,
      states: [...wf.states].reverse(),
    };

    const descReversed = describeTransition(tr, reversedWf);

    expect(descOriginal).toEqual(descReversed);
  });

  it("19. Canvas edge data updates after transition editing", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;

    let kinds = classifyWorkflowEdges(useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!);
    expect(kinds["tr-init"]).toBe("forward");

    // Edit transition target to form a self-loop
    store.updateTransition(testWfId, "tr-init", { targetStateId: startState.id });

    kinds = classifyWorkflowEdges(useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!);
    expect(kinds["tr-init"]).toBe("self_loop");
  });

  it("20. Runtime runs and audit records remain unchanged", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;

    // Start a run
    const run = createWorkflowRun(wf, { name: "Run for P1.4 Test" });
    expect(run.status).toBe("active");
    expect(run.history.length).toBeGreaterThan(0);

    // Edit transition definition on workflow
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "tr-runtime-check",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "RUNTIME_EVENT",
    });

    // Run status and history remain completely unchanged
    expect(run.status).toBe("active");
    expect(run.workflowId).toBe(wf.id);
    expect(run.history.length).toBeGreaterThan(0);
  });
});
