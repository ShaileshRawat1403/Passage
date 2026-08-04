import { describe, it, expect } from "vitest";
import { planTransition } from "../src/domain/planner";
import { WorkflowDefinition, WorkflowRun } from "../src/types/workflow";
import { createWorkflowRun } from "../src/domain/runtime";

describe("Transition Planner (planTransition)", () => {
  const sampleWorkflow: WorkflowDefinition = {
    id: "order-process-wf",
    name: "Order Processing Workflow",
    version: "1.0.0",
    status: "published",
    initialStateId: "order-created",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    states: [
      {
        id: "order-created",
        name: "Order Created",
        type: "start",
        entryActions: [],
        activeActions: [],
        exitActions: [
          {
            id: "exit-action-1",
            name: "Log Order Exited",
            type: "audit",
          },
        ],
        transitions: [
          {
            id: "tr-submit",
            name: "Submit Order",
            sourceStateId: "order-created",
            targetStateId: "payment-pending",
            event: "SUBMIT_ORDER",
            actions: [
              {
                id: "tr-action-1",
                name: "Notify Payment Service",
                type: "notification",
              },
            ],
          },
        ],
      },
      {
        id: "payment-pending",
        name: "Payment Pending",
        type: "atomic",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [
          {
            id: "tr-pay-standard",
            name: "Standard Payment Route",
            sourceStateId: "payment-pending",
            targetStateId: "order-fulfilled",
            event: "PAYMENT_RECEIVED",
            priority: 10,
            guard: {
              id: "guard-low-amount",
              name: "Low Amount Guard",
              logic: "ALL",
              conditions: [
                {
                  id: "cond-1",
                  field: "amount",
                  operator: "less_than_or_equal",
                  value: 1000,
                },
              ],
            },
          },
          {
            id: "tr-pay-vip",
            name: "VIP Express Route",
            sourceStateId: "payment-pending",
            targetStateId: "vip-fulfillment",
            event: "PAYMENT_RECEIVED",
            priority: 20,
            guard: {
              id: "guard-vip",
              name: "VIP Customer Guard",
              logic: "ALL",
              conditions: [
                {
                  id: "cond-2",
                  field: "isVip",
                  operator: "is_true",
                },
              ],
            },
          },
        ],
      },
      {
        id: "vip-fulfillment",
        name: "VIP Fulfillment",
        type: "atomic",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
      {
        id: "order-fulfilled",
        name: "Order Fulfilled",
        type: "final",
        entryActions: [],
        activeActions: [],
        exitActions: [],
        transitions: [],
      },
    ],
  };

  it("SUCCESS: Plans a valid transition when event matches and guards pass", () => {
    const run = createWorkflowRun(sampleWorkflow, { amount: 500 });
    const result = planTransition({
      workflow: sampleWorkflow,
      run,
      event: "SUBMIT_ORDER",
    });

    expect(result.status).toBe("transition_ready");
    expect(result.selectedTransition?.id).toBe("tr-submit");
    expect(result.targetState?.id).toBe("payment-pending");
    expect(result.plannedExitActions).toHaveLength(1);
    expect(result.plannedTransitionActions).toHaveLength(1);
  });

  it("SUCCESS: Selects higher priority transition when multiple guards pass", () => {
    const run = createWorkflowRun(sampleWorkflow, { amount: 200, isVip: true });
    // Move run to payment-pending state
    const paymentPendingRun: WorkflowRun = {
      ...run,
      currentStateId: "payment-pending",
    };

    const result = planTransition({
      workflow: sampleWorkflow,
      run: paymentPendingRun,
      event: "PAYMENT_RECEIVED",
    });

    expect(result.status).toBe("transition_ready");
    // Priority 20 (VIP Express Route) should be selected over Priority 10
    expect(result.selectedTransition?.id).toBe("tr-pay-vip");
    expect(result.targetState?.id).toBe("vip-fulfillment");
  });

  it("REJECTION: Blocks transition when guard condition fails", () => {
    const run = createWorkflowRun(sampleWorkflow, { amount: 5000, isVip: false });
    const paymentPendingRun: WorkflowRun = {
      ...run,
      currentStateId: "payment-pending",
    };

    const result = planTransition({
      workflow: sampleWorkflow,
      run: paymentPendingRun,
      event: "PAYMENT_RECEIVED",
    });

    expect(result.status).toBe("blocked");
    expect(result.error).toContain("all transition guards blocked");
    expect(result.guardResults).toHaveLength(2);
    expect(result.guardResults?.every((g) => !g.passed)).toBe(true);
  });

  it("REJECTION: Fails with no_transition_found when trigger event is unhandled", () => {
    const run = createWorkflowRun(sampleWorkflow);
    const result = planTransition({
      workflow: sampleWorkflow,
      run,
      event: "UNKNOWN_EVENT",
    });

    expect(result.status).toBe("no_transition_found");
    expect(result.error).toContain('No transition registered in state "Order Created"');
  });

  it("REJECTION: Fails with ambiguous status when equal-priority transitions pass", () => {
    const ambiguousWorkflow: WorkflowDefinition = {
      ...sampleWorkflow,
      states: [
        {
          id: "decision-state",
          name: "Decision State",
          type: "start",
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [
            {
              id: "route-1",
              sourceStateId: "decision-state",
              targetStateId: "vip-fulfillment",
              event: "GO",
              priority: 10,
            },
            {
              id: "route-2",
              sourceStateId: "decision-state",
              targetStateId: "order-fulfilled",
              event: "GO",
              priority: 10, // Same priority 10 => ambiguous
            },
          ],
        },
        ...sampleWorkflow.states.slice(2),
      ],
    };

    const run = createWorkflowRun(ambiguousWorkflow);
    const result = planTransition({
      workflow: ambiguousWorkflow,
      run,
      event: "GO",
    });

    expect(result.status).toBe("ambiguous");
    expect(result.error).toContain("Ambiguous transition selection");
  });

  it("REJECTION: Rejects transitions from terminal (final) states", () => {
    const run = createWorkflowRun(sampleWorkflow);
    const terminalRun: WorkflowRun = {
      ...run,
      currentStateId: "order-fulfilled",
      status: "completed",
    };

    const result = planTransition({
      workflow: sampleWorkflow,
      run: terminalRun,
      event: "ANY_EVENT",
    });

    expect(result.status).toBe("terminal_state");
    expect(result.error).toContain("already in terminal status");
  });

  it("REJECTION: Fails with invalid_state if target state ID does not exist", () => {
    const brokenWorkflow: WorkflowDefinition = {
      ...sampleWorkflow,
      states: [
        {
          id: "broken-state",
          name: "Broken State",
          type: "start",
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [
            {
              id: "tr-broken",
              sourceStateId: "broken-state",
              targetStateId: "non-existent-state",
              event: "GO",
            },
          ],
        },
      ],
    };

    const run = createWorkflowRun(brokenWorkflow);
    const result = planTransition({
      workflow: brokenWorkflow,
      run,
      event: "GO",
    });

    expect(result.status).toBe("invalid_state");
    expect(result.error).toContain('does not exist');
  });
});
