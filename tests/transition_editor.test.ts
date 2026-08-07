import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";
import { WorkflowDefinition, TransitionDefinition } from "../src/types/workflow";
import { describeTransition, formatGuard, formatConditionRule, checkGuardIncomplete } from "../src/domain/transitionFormatter";
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
      actions: [{ id: "act-1", name: "Activity Log", type: "audit" }],
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
    store.updateTransition(testWfId, "tr-init", { targetStateId: startState.id, event: "SELF_LOOP_EVENT" });

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    kinds = classifyWorkflowEdges(updatedWf);
    expect(kinds["tr-init"]).toBe("self_loop");

    // Check edge description formatting reflect updated event and classification
    const updatedTr = updatedWf.states.flatMap((s) => s.transitions).find((t) => t.id === "tr-init")!;
    const desc = describeTransition(updatedTr, updatedWf);
    expect(desc.eventLabel).toBe("SELF_LOOP_EVENT");
  });

  it("20. Runtime runs and activity records remain unchanged", () => {
    const store = useWorkflowStore.getState();
    const run = store.startNewRun(testWfId);
    expect(run).toBeDefined();

    const runsBefore = JSON.parse(JSON.stringify(useWorkflowStore.getState().activeRuns.filter((r) => r.workflowId === testWfId)));
    const historyBefore = JSON.parse(JSON.stringify(store.historyByWorkflowId[testWfId] || { past: [], future: [] }));

    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "tr-runtime-check",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "RUNTIME_EVENT",
    });

    const storeAfter = useWorkflowStore.getState();
    const runsAfter = JSON.parse(JSON.stringify(storeAfter.activeRuns.filter((r) => r.workflowId === testWfId)));

    // Active runs and their execution histories remain completely untouched by transition edits
    expect(runsAfter).toEqual(runsBefore);
  });

  it("21. checkGuardIncomplete detects incomplete rules accurately", () => {
    // Value-free operators complete without value
    expect(checkGuardIncomplete({
      id: "g1",
      name: "Guard 1",
      logic: "ALL",
      conditions: [{ id: "c1", field: "amount", operator: "exists" }],
    })).toBe(false);

    expect(checkGuardIncomplete({
      id: "g2",
      name: "Guard 2",
      logic: "ALL",
      conditions: [{ id: "c2", field: "isApproved", operator: "is_true" }],
    })).toBe(false);

    // Value-requiring operators without value are incomplete
    expect(checkGuardIncomplete({
      id: "g3",
      name: "Guard 3",
      logic: "ALL",
      conditions: [{ id: "c3", field: "amount", operator: "equals", value: "" }],
    })).toBe(true);

    expect(checkGuardIncomplete({
      id: "g4",
      name: "Guard 4",
      logic: "ALL",
      conditions: [{ id: "c4", field: "status", operator: "is_one_of" }],
    })).toBe(true);

    // Complete condition with value
    expect(checkGuardIncomplete({
      id: "g5",
      name: "Guard 5",
      logic: "ALL",
      conditions: [{ id: "c5", field: "amount", operator: "greater_than", value: "100" }],
    })).toBe(false);
  });

  it("22. Equal-priority ambiguous routes produce per-transition validation issues", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;
    const finalState = wf.states.find((s) => s.type === "final")!;

    store.addTransition(testWfId, {
      id: "tr-ambig-1",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "SAME_EVENT",
      priority: 10,
    });

    store.addTransition(testWfId, {
      id: "tr-ambig-2",
      sourceStateId: startState.id,
      targetStateId: finalState.id,
      event: "SAME_EVENT",
      priority: 10,
    });

    const issues = validateWorkflow(useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!);
    const ambig1Issues = issues.filter((i) => i.transitionId === "tr-ambig-1");
    const ambig2Issues = issues.filter((i) => i.transitionId === "tr-ambig-2");

    expect(ambig1Issues.length).toBeGreaterThan(0);
    expect(ambig2Issues.length).toBeGreaterThan(0);
    expect(ambig1Issues[0]?.message).toContain("non-deterministic");
  });

  it("23. addTransition with empty ID auto-generates designer ID from occupied set", () => {
    const store = useWorkflowStore.getState();
    const wf = store.workflows.find((w) => w.id === testWfId)!;
    const startState = wf.states.find((s) => s.type === "start")!;
    const atomicState = wf.states.find((s) => s.type === "atomic")!;

    store.addTransition(testWfId, {
      id: "",
      sourceStateId: startState.id,
      targetStateId: atomicState.id,
      event: "DESIGNER_ID_EVENT",
    });

    const updatedWf = useWorkflowStore.getState().workflows.find((w) => w.id === testWfId)!;
    const tr = updatedWf.states.flatMap((s) => s.transitions).find((t) => t.event === "DESIGNER_ID_EVENT")!;

    expect(tr.id).toMatch(/^tr-/);
    expect(tr.id).not.toContain("tr-17"); // Not timestamp based
  });
});
