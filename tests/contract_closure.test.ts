import { describe, it, expect } from "vitest";
import { parseWorkflowDefinition } from "../src/domain/parser";
import { evaluateGuard } from "../src/domain/guardEvaluator";
import { executeAction, applyActionOutputToContext } from "../src/domain/actionExecutor";
import { createWorkflowRun, dispatchWorkflowEvent } from "../src/domain/runtime";
import { createTestEnvironment } from "../src/domain/runtimeEnvironment";
import { WorkflowDefinition } from "../src/types/workflow";

describe("P0.1 Contract Closure - Ingress Parser & Strict Schemas", () => {
  const validBaseWorkflow = {
    id: "wf-strict-1",
    name: "Strict Base Workflow",
    version: "1.0.0",
    status: "published" as const,
    initialStateId: "start",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    states: [
      {
        id: "start",
        name: "Start",
        type: "start" as const,
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [
          {
            id: "tr-1",
            sourceStateId: "start",
            targetStateId: "end",
            event: "COMPLETE",
          },
        ],
      },
      {
        id: "end",
        name: "End",
        type: "final" as const,
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should successfully parse valid workflow definition", () => {
    const res = parseWorkflowDefinition(validBaseWorkflow);
    expect(res.success).toBe(true);
    expect(res.workflow?.id).toBe("wf-strict-1");
    expect(res.errors).toHaveLength(0);
  });

  it("should REJECT unknown properties at ingress boundary due to strict Zod schema", () => {
    const invalidWithUnknownProp = {
      ...validBaseWorkflow,
      unauthorizedExtraField: "HAX_PAYLOAD", // Unknown field
    };

    const res = parseWorkflowDefinition(invalidWithUnknownProp);
    expect(res.success).toBe(false);
    expect(res.errors.some((e) => e.includes("unrecognized_keys") || e.includes("unauthorizedExtraField"))).toBe(true);
  });

  it("should REJECT unknown properties inside state definitions", () => {
    const invalidStateWithExtra = {
      ...validBaseWorkflow,
      states: [
        {
          ...validBaseWorkflow.states[0],
          extraStateProperty: "illegal",
        },
        validBaseWorkflow.states[1],
      ],
    };

    const res = parseWorkflowDefinition(invalidStateWithExtra);
    expect(res.success).toBe(false);
    expect(res.errors.some((e) => e.includes("unrecognized_keys") || e.includes("extraStateProperty"))).toBe(true);
  });

  it("should REJECT initial state that does not point to a Start state", () => {
    const invalidInitialState = {
      ...validBaseWorkflow,
      initialStateId: "end", // 'end' is a final state, not start
    };

    const res = parseWorkflowDefinition(invalidInitialState);
    expect(res.success).toBe(false);
    expect(res.errors.some((e) => e.includes("must be of type \"start\""))).toBe(true);
  });
});

describe("P0.1 Contract Closure - Fail Invalid Guards Closed", () => {
  it("should FAIL CLOSED (passed: false) when rawExpression cannot be parsed", () => {
    const guardWithGarbageExpression = {
      id: "g-bad",
      name: "Bad Guard Expression",
      logic: "ALL" as const,
      conditions: [], // No conditions
      rawExpression: "SELECT * FROM users WHERE 1=1 --- garbage sql expression",
    };

    const res = evaluateGuard(guardWithGarbageExpression, { amount: 100 });
    expect(res.passed).toBe(false);
    expect(res.reason).toContain("could not be parsed or evaluated");
  });
});

describe("P0.1 Contract Closure - Explicit Output Mapping Requirement", () => {
  it("should NOT modify context when action has NO outputMapping", () => {
    const actionWithoutMapping = {
      id: "act-http-no-map",
      name: "HTTP Call Without Mapping",
      type: "http" as const,
      httpConfig: {
        method: "GET" as const,
        url: "https://api.example.com/check",
      },
    };

    const currentContext = { invoiceId: "INV-100", amount: 5000 };
    const actionResult = executeAction(actionWithoutMapping, currentContext);

    const newContext = applyActionOutputToContext(currentContext, actionWithoutMapping, actionResult);

    // Context MUST remain strictly identical
    expect(newContext).toEqual(currentContext);
  });

  it("should modify context ONLY according to explicit outputMapping", () => {
    const actionWithExplicitMapping = {
      id: "act-http-mapped",
      name: "HTTP Call With Explicit Mapping",
      type: "http" as const,
      outputMapping: {
        statusCode: "$.meta.httpStatus",
      },
    };

    const currentContext = { invoiceId: "INV-100" };
    const actionResult = executeAction(actionWithExplicitMapping, currentContext);

    const newContext = applyActionOutputToContext(currentContext, actionWithExplicitMapping, actionResult);

    expect(newContext).toEqual({
      invoiceId: "INV-100",
      meta: {
        httpStatus: 200,
      },
    });
  });
});

describe("P0.1 Contract Closure - Deterministic Runtime Environment", () => {
  const testWf: WorkflowDefinition = {
    id: "wf-det-1",
    name: "Deterministic Test Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "start",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    states: [
      {
        id: "start",
        name: "Start State",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [
          {
            id: "tr-1",
            sourceStateId: "start",
            targetStateId: "finish",
            event: "PROCEED",
          },
        ],
      },
      {
        id: "finish",
        name: "Finish State",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should execute reproducibly when injected with a fixed RuntimeEnvironment", () => {
    const fixedTime = "2026-08-04T12:00:00.000Z";
    const env1 = createTestEnvironment(fixedTime);
    const env2 = createTestEnvironment(fixedTime);

    const run1 = createWorkflowRun(testWf, {}, "CASE-100", env1);
    const run2 = createWorkflowRun(testWf, {}, "CASE-100", env2);

    expect(run1).toEqual(run2);

    const dispatch1 = dispatchWorkflowEvent(testWf, run1, "PROCEED", "Tester", env1);
    const dispatch2 = dispatchWorkflowEvent(testWf, run2, "PROCEED", "Tester", env2);

    expect(dispatch1.updatedRun).toEqual(dispatch2.updatedRun);
    expect(dispatch1.updatedRun.startedAt).toBe(fixedTime);
    expect(dispatch1.updatedRun.auditTrail[0]?.id).toContain("AUDIT-TEST-");
  });
});

describe("P0.1B Transaction and Evidence Closure - Terminal Statuses", () => {
  const baseWf: WorkflowDefinition = {
    id: "wf-term-1",
    name: "Terminal Status Test Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "start",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    states: [
      {
        id: "start",
        name: "Start State",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [
          {
            id: "tr-1",
            sourceStateId: "start",
            targetStateId: "finish",
            event: "NEXT",
          },
        ],
      },
      {
        id: "finish",
        name: "Finish State",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should REJECT transitions for cancelled runs as terminal", () => {
    const env = createTestEnvironment();
    const run = createWorkflowRun(baseWf, {}, "CASE-CANCEL", env);
    const cancelledRun = { ...run, status: "cancelled" as const };

    const result = dispatchWorkflowEvent(baseWf, cancelledRun, "NEXT", "Operator", env);
    expect(result.plan.status).toBe("terminal_state");
    expect(result.error).toContain("cancelled");
  });
});

describe("P0.1B Transaction and Evidence Closure - Failure Audit Semantics & Transactional Ordering", () => {
  const failingExitWf: WorkflowDefinition = {
    id: "wf-fail-exit",
    name: "Failing Exit Action Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "start",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    states: [
      {
        id: "start",
        name: "Start State",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [
          {
            id: "act-exit-fail",
            name: "Failing Exit Action",
            type: "http",
            httpConfig: {
              method: "POST",
              url: "https://example.com/fail",
            },
          },
        ],
        transitions: [
          {
            id: "tr-1",
            sourceStateId: "start",
            targetStateId: "finish",
            event: "NEXT",
          },
        ],
      },
      {
        id: "finish",
        name: "Finish State",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should NOT record state_exited or return transitionTaken when exit action fails", () => {
    const env = createTestEnvironment(undefined, {
      executeAction: (action, _context, env) => {
        if (action.id === "act-exit-fail") {
          return {
            actionId: action.id,
            actionName: action.name,
            status: "failure",
            error: "Exit action failed explicitly",
            output: {},
            executedAt: env.now(),
          };
        }
        return {
          actionId: action.id,
          actionName: action.name,
          status: "success",
          output: {},
          executedAt: env.now(),
        };
      },
    });

    const run = createWorkflowRun(failingExitWf, {}, "CASE-EXIT-FAIL", env);

    const result = dispatchWorkflowEvent(failingExitWf, run, "NEXT", "Operator", env);

    expect(result.updatedRun.status).toBe("failed");
    expect(result.transitionTaken).toBeUndefined();

    const stateExitedEvent = result.updatedRun.auditTrail.find((a) => a.eventType === "state_exited");
    expect(stateExitedEvent).toBeUndefined();
  });

  const failingTransitionWf: WorkflowDefinition = {
    id: "wf-fail-trans",
    name: "Failing Transition Action Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "start",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    states: [
      {
        id: "start",
        name: "Start State",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [
          {
            id: "tr-1",
            sourceStateId: "start",
            targetStateId: "finish",
            event: "NEXT",
            actions: [
              {
                id: "act-trans-fail",
                name: "Failing Transition Action",
                type: "http",
                httpConfig: {
                  method: "POST",
                  url: "https://example.com/fail-trans",
                },
              },
            ],
          },
        ],
      },
      {
        id: "finish",
        name: "Finish State",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("should NOT record state_exited or transition_taken when transition action fails", () => {
    const env = createTestEnvironment(undefined, {
      executeAction: (action, _context, env) => {
        if (action.id === "act-trans-fail") {
          return {
            actionId: action.id,
            actionName: action.name,
            status: "failure",
            error: "Transition action failed explicitly",
            output: {},
            executedAt: env.now(),
          };
        }
        return {
          actionId: action.id,
          actionName: action.name,
          status: "success",
          output: {},
          executedAt: env.now(),
        };
      },
    });

    const run = createWorkflowRun(failingTransitionWf, {}, "CASE-TRANS-FAIL", env);

    const result = dispatchWorkflowEvent(failingTransitionWf, run, "NEXT", "Operator", env);

    expect(result.updatedRun.status).toBe("failed");
    expect(result.updatedRun.currentStateId).toBe("start");
    expect(result.transitionTaken).toBeUndefined();

    const stateExitedEvent = result.updatedRun.auditTrail.find((a) => a.eventType === "state_exited");
    expect(stateExitedEvent).toBeUndefined();

    const transitionTakenEvent = result.updatedRun.auditTrail.find((a) => a.eventType === "transition_taken");
    expect(transitionTakenEvent).toBeUndefined();
  });
});

describe("P0.1B Transaction and Evidence Closure - Parallel Policy Mode 'all'", () => {
  it("should REJECT parallel policy mode other than 'all'", () => {
    const invalidParallelWf = {
      id: "wf-par-invalid",
      name: "Invalid Parallel Policy Workflow",
      version: "1.0.0",
      status: "published",
      initialStateId: "start",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
      states: [
        {
          id: "start",
          name: "Start Parallel State",
          type: "start",
          parallelPolicy: { mode: "any" }, // Invalid policy mode
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [
            {
              id: "tr-1",
              sourceStateId: "start",
              targetStateId: "finish",
              event: "NEXT",
            },
          ],
        },
        {
          id: "finish",
          name: "Finish State",
          type: "final",
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [],
        },
      ],
    };

    const parsed = parseWorkflowDefinition(invalidParallelWf);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((error) => error.includes("parallelPolicy.mode"))).toBe(true);
  });
});

describe("P0.1B Transaction and Evidence Closure - Bundled Workflows Verification", () => {
  it("should validate EVERY bundled sample workflow definition cleanly", async () => {
    const { sampleWorkflows } = await import("../src/domain/sampleWorkflows");
    const { validateWorkflow } = await import("../src/domain/validation");

    expect(sampleWorkflows.length).toBeGreaterThan(0);

    for (const wf of sampleWorkflows) {
      const parseRes = parseWorkflowDefinition(wf);
      expect(parseRes.success).toBe(true);
      expect(parseRes.workflow).toBeDefined();

      if (parseRes.workflow) {
        const issues = validateWorkflow(parseRes.workflow);
        const errors = issues.filter((i) => i.severity === "error");
        expect(errors).toHaveLength(0);
      }
    }
  });
});
