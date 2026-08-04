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
    expect(dispatch1.updatedRun.auditTrail[0].id).toContain("AUDIT-TEST-");
  });
});
