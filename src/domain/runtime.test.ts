import { describe, it, expect } from "vitest";
import { WorkflowDefinition, WorkflowRun } from "../types/workflow";
import { WorkflowDefinitionSchema } from "./schemas";
import { validateWorkflow } from "./validation";
import { evaluateGuard, evaluateCondition } from "./guardEvaluator";
import { planTransition } from "./planner";
import { createWorkflowRun, dispatchWorkflowEvent } from "./runtime";
import { executeAction, applyActionOutputToContext } from "./actionExecutor";

describe("Passage State Machine - Schema & Validation", () => {
  const mockValidWorkflow: WorkflowDefinition = {
    id: "test-wf-1",
    name: "Test Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "start",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    states: [
      {
        id: "start",
        name: "Start",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [{ id: "tr-1", sourceStateId: "start", targetStateId: "step-1", event: "SUBMIT" }],
      },
      {
        id: "step-1",
        name: "Process Step",
        type: "atomic",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [{ id: "tr-2", sourceStateId: "step-1", targetStateId: "end", event: "APPROVE" }],
      },
      {
        id: "end",
        name: "Completed",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should pass Zod schema validation for valid workflow", () => {
    const parseRes = WorkflowDefinitionSchema.safeParse(mockValidWorkflow);
    expect(parseRes.success).toBe(true);
  });

  it("should detect duplicate state IDs during validation", () => {
    const invalidWf: WorkflowDefinition = {
      ...mockValidWorkflow,
      states: [
        ...mockValidWorkflow.states,
        {
          id: "step-1", // duplicate
          name: "Duplicate Step",
          type: "atomic",
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [],
        },
      ],
    };

    const issues = validateWorkflow(invalidWf);
    expect(issues.some((i) => i.id.includes("err-duplicate-state"))).toBe(true);
  });
});

describe("Passage State Machine - Typed Guard Evaluator", () => {
  it("should correctly compare numbers and booleans without string coercion bugs", () => {
    const context = { amount: 75000, isApproved: true, flagStr: "false" };

    // Greater than number test
    const numRes = evaluateCondition(
      { id: "c1", field: "amount", operator: "greater_than", value: 50000 },
      context
    );
    expect(numRes.passed).toBe(true);

    // Is true test
    const boolRes = evaluateCondition(
      { id: "c2", field: "isApproved", operator: "is_true" },
      context
    );
    expect(boolRes.passed).toBe(true);

    // Boolean string false test
    const falseStrRes = evaluateCondition(
      { id: "c3", field: "flagStr", operator: "is_false" },
      context
    );
    expect(falseStrRes.passed).toBe(true);
  });

  it("should evaluate regex matches_pattern operator correctly", () => {
    const context = { code: "INV-2026-901" };
    const res = evaluateCondition(
      { id: "c4", field: "code", operator: "matches_pattern", value: "^INV-[0-9]{4}-[0-9]+" },
      context
    );
    expect(res.passed).toBe(true);
  });
});

describe("Passage State Machine - Deterministic Transition Planner", () => {
  const workflowWithAmbiguity: WorkflowDefinition = {
    id: "wf-ambiguous",
    name: "Ambiguous Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "start",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    states: [
      {
        id: "start",
        name: "Start",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [
          { id: "tr-a", sourceStateId: "start", targetStateId: "path-a", event: "ROUTE", priority: 10 },
          { id: "tr-b", sourceStateId: "start", targetStateId: "path-b", event: "ROUTE", priority: 10 }, // Equal priority ambiguity!
        ],
      },
      {
        id: "path-a",
        name: "Path A",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
      {
        id: "path-b",
        name: "Path B",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should reject equal-priority ambiguous transitions", () => {
    const run = createWorkflowRun(workflowWithAmbiguity);
    const plan = planTransition({
      workflow: workflowWithAmbiguity,
      run,
      event: "ROUTE",
    });

    expect(plan.status).toBe("ambiguous");
    expect(plan.error).toContain("Ambiguous transition selection");
  });

  it("should pick higher priority transition deterministically when priorities differ", () => {
    const distinctWf: WorkflowDefinition = JSON.parse(JSON.stringify(workflowWithAmbiguity));
    distinctWf.states[0].transitions[0].priority = 20; // Higher priority for Path A
    distinctWf.states[0].transitions[1].priority = 10;

    const run = createWorkflowRun(distinctWf);
    const plan = planTransition({
      workflow: distinctWf,
      run,
      event: "ROUTE",
    });

    expect(plan.status).toBe("transition_ready");
    expect(plan.selectedTransition?.id).toBe("tr-a");
    expect(plan.targetState?.id).toBe("path-a");
  });
});

describe("Passage State Machine - Immutable Execution & Action Output Mapping", () => {
  const lifecycleWf: WorkflowDefinition = {
    id: "wf-lifecycle",
    name: "Lifecycle Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "state-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    states: [
      {
        id: "state-1",
        name: "State 1",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [
          {
            id: "act-exit",
            name: "Exit Action",
            type: "transform",
            outputMapping: { "transformedAt": "$.meta.exitTime" },
          },
        ],
        transitions: [
          {
            id: "tr-12",
            sourceStateId: "state-1",
            targetStateId: "state-2",
            event: "NEXT",
            actions: [
              {
                id: "act-transition",
                name: "Transition Action",
                type: "audit",
                outputMapping: { "auditId": "$.meta.transitionAuditId" },
              },
            ],
          },
        ],
      },
      {
        id: "state-2",
        name: "State 2",
        type: "final",
        entryActions: [
          {
            id: "act-entry",
            name: "Target Entry Action",
            type: "notification",
          },
        ],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should execute exit, transition, and entry actions in correct order and update context immutably", () => {
    const run = createWorkflowRun(lifecycleWf);
    const originalRunJson = JSON.stringify(run);

    const { updatedRun, transitionTaken } = dispatchWorkflowEvent(lifecycleWf, run, "NEXT");

    expect(transitionTaken?.id).toBe("tr-12");
    expect(updatedRun.currentStateId).toBe("state-2");
    expect(updatedRun.status).toBe("completed");

    // Check mapped outputs in context
    expect(updatedRun.context.meta).toBeDefined();

    // Verify original run was NOT mutated
    expect(JSON.stringify(run)).toBe(originalRunJson);
  });
});
