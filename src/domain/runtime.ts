import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowRun,
  AuditEvent,
  WorkflowEvent,
  TransitionDefinition,
  ActionDefinition,
} from "../types/workflow";
import { planTransition, TransitionPlanResult } from "./planner";
import { executeAction, applyActionOutputToContext } from "./actionExecutor";
import { RuntimeEnvironment, defaultProductionEnv } from "./runtimeEnvironment";

/**
 * Pure, immutable factory that initializes a new workflow execution run
 */
export function createWorkflowRun(
  workflow: WorkflowDefinition,
  initialContext: Record<string, unknown> = {},
  customCaseId?: string,
  env: RuntimeEnvironment = defaultProductionEnv
): WorkflowRun {
  const caseId = customCaseId || env.createId("CASE");
  const runId = env.createId("RUN");
  const now = env.now();

  const startState =
    workflow.states.find((s) => s.id === workflow.initialStateId) ||
    workflow.states.find((s) => s.type === "start") ||
    workflow.states[0];

  if (!startState) {
    throw new Error(`Workflow "${workflow.id}" does not contain any states.`);
  }

  const mergedContext = {
    caseId,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    ...(workflow.defaultContext || {}),
    ...initialContext,
  };

  const initialAudit: AuditEvent = {
    id: env.createId("AUDIT"),
    workflowRunId: runId,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "workflow_started",
    actor: "System Engine",
    stateId: startState.id,
    metadata: { initialContext: mergedContext },
  };

  const initialRun: WorkflowRun = {
    id: runId,
    caseId,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    status: "active",
    currentStateId: startState.id,
    context: mergedContext,
    history: [
      {
        stateId: startState.id,
        enteredAt: now,
      },
    ],
    visitedStateIds: [startState.id],
    completedActionCount: 0,
    failedActionCount: 0,
    retryCount: 0,
    startedAt: now,
    lastEventAt: now,
    auditTrail: [initialAudit],
  };

  // Process initial state lifecycle actions purely
  return executeStateLifecycle(workflow, initialRun, startState, "WORKFLOW_STARTED", env);
}

/**
 * Pure function that processes entry and active actions for a state and produces an immutable updated run.
 */
export function executeStateLifecycle(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  state: WorkflowState,
  triggerEvent: string,
  env: RuntimeEnvironment = defaultProductionEnv
): WorkflowRun {
  const now = env.now();
  let currentContext = { ...run.context };
  let auditTrail = [...run.auditTrail];
  let completedActions = run.completedActionCount;
  let failedActions = run.failedActionCount;
  let hasFailed = false;

  // 1. Activity State Entry
  auditTrail.push({
    id: env.createId("AUDIT"),
    workflowRunId: run.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "state_entered",
    stateId: state.id,
    metadata: { triggerEvent, stateName: state.name, stateType: state.type },
  });

  // Helper to execute sequential actions
  const runActionSequential = (action: ActionDefinition, phase: "entry" | "active" | "exit") => {
    if (hasFailed) return;

    auditTrail.push({
      id: env.createId("AUDIT"),
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: env.now(),
      eventType: "action_started",
      stateId: state.id,
      actionId: action.id,
      metadata: { actionName: action.name, phase },
    });

    const actionRes = executeAction(action, currentContext, env);

    if (actionRes.status === "failure") {
      failedActions += 1;
      hasFailed = true;
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "action_failed",
        stateId: state.id,
        actionId: action.id,
        metadata: { actionName: action.name, error: actionRes.error, phase },
      });
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "workflow_failed",
        stateId: state.id,
        metadata: { reason: `Action "${action.name}" (${action.id}) failed: ${actionRes.error}` },
      });
    } else {
      completedActions += 1;
      currentContext = applyActionOutputToContext(currentContext, action, actionRes);
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "action_completed",
        stateId: state.id,
        actionId: action.id,
        metadata: { actionName: action.name, output: actionRes.output, phase },
      });
    }
  };

  // 2. Execute Entry Actions
  for (const action of state.entryActions || []) {
    runActionSequential(action, "entry");
    if (hasFailed) break;
  }

  // 3. Execute Active Actions
  if (!hasFailed) {
    if (state.type === "parallel") {
      // Deterministic parallel execution semantics: all parallel actions execute against the same snapshot context
      const snapshotContext = { ...currentContext };
      const parallelOutputs: Array<{ action: ActionDefinition; result: ReturnType<typeof executeAction> }> = [];

      for (const action of state.activeActions || []) {
        auditTrail.push({
          id: env.createId("AUDIT"),
          workflowRunId: run.id,
          workflowVersion: workflow.version,
          timestamp: env.now(),
          eventType: "action_started",
          stateId: state.id,
          actionId: action.id,
          metadata: { actionName: action.name, phase: "active", executionMode: "parallel" },
        });

        const actionRes = executeAction(action, snapshotContext, env);

        if (actionRes.status === "failure") {
          failedActions += 1;
          hasFailed = true;
          auditTrail.push({
            id: env.createId("AUDIT"),
            workflowRunId: run.id,
            workflowVersion: workflow.version,
            timestamp: env.now(),
            eventType: "action_failed",
            stateId: state.id,
            actionId: action.id,
            metadata: { actionName: action.name, error: actionRes.error, phase: "active" },
          });
          auditTrail.push({
            id: env.createId("AUDIT"),
            workflowRunId: run.id,
            workflowVersion: workflow.version,
            timestamp: env.now(),
            eventType: "workflow_failed",
            stateId: state.id,
            metadata: { reason: `Parallel action "${action.name}" (${action.id}) failed: ${actionRes.error}` },
          });
          break;
        } else {
          completedActions += 1;
          parallelOutputs.push({ action, result: actionRes });
          auditTrail.push({
            id: env.createId("AUDIT"),
            workflowRunId: run.id,
            workflowVersion: workflow.version,
            timestamp: env.now(),
            eventType: "action_completed",
            stateId: state.id,
            actionId: action.id,
            metadata: { actionName: action.name, output: actionRes.output, phase: "active" },
          });
        }
      }

      if (!hasFailed) {
        // Merge outputs of all parallel actions into currentContext
        for (const item of parallelOutputs) {
          currentContext = applyActionOutputToContext(currentContext, item.action, item.result);
        }
      }
    } else {
      for (const action of state.activeActions || []) {
        runActionSequential(action, "active");
        if (hasFailed) break;
      }
    }
  }

  // Determine updated run status
  if (hasFailed) {
    return {
      ...run,
      status: "failed",
      context: currentContext,
      completedActionCount: completedActions,
      failedActionCount: failedActions,
      auditTrail,
    };
  }

  let newStatus = run.status;
  let completedAt = run.completedAt;
  let pendingApproval = run.pendingApproval;

  if (state.type === "final") {
    newStatus = "completed";
    completedAt = env.now();
    auditTrail.push({
      id: env.createId("AUDIT"),
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: completedAt,
      eventType: "workflow_completed",
      stateId: state.id,
      metadata: { finalState: state.name },
    });
  } else if (state.type === "waiting" || state.type === "approval") {
    newStatus = "waiting";

    if (state.type === "approval") {
      const humanTask = [...(state.entryActions || []), ...(state.activeActions || [])].find(
        (a) => a.type === "human_task"
      );
      const role = humanTask?.humanTaskConfig?.assigneeRole || "Reviewer";
      const dueHours = humanTask?.humanTaskConfig?.dueHours || 24;
      const dueAt = env.addMilliseconds(now, dueHours * 60 * 60 * 1000);

      pendingApproval = {
        assigneeRole: role,
        requestedAt: now,
        dueAt,
        availableDecisions: humanTask?.humanTaskConfig?.options || [
          "APPROVE",
          "REJECT",
          "REQUEST_CHANGES",
        ],
      };

      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: now,
        eventType: "human_approval_requested",
        stateId: state.id,
        actor: role,
        metadata: { dueAt, choices: pendingApproval.availableDecisions },
      });
    }
  }

  return {
    ...run,
    status: newStatus,
    completedAt,
    pendingApproval,
    context: currentContext,
    completedActionCount: completedActions,
    failedActionCount: failedActions,
    auditTrail,
  };
}

/**
 * Pure dispatcher that takes an event, plans the transition, executes lifecycle actions,
 * and produces a new immutable WorkflowRun.
 */
export function dispatchWorkflowEvent(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  event: WorkflowEvent | string,
  actor: string = "User Operator",
  env: RuntimeEnvironment = defaultProductionEnv
): { updatedRun: WorkflowRun; transitionTaken?: TransitionDefinition; error?: string; plan: TransitionPlanResult } {
  const eventName = typeof event === "string" ? event : event.type;
  const eventPayload = typeof event === "object" ? event.payload : undefined;

  // Merge payload into context immutably
  let currentContext = { ...run.context };
  if (eventPayload && Object.keys(eventPayload).length > 0) {
    currentContext = { ...currentContext, ...eventPayload };
  }

  const currentRunWithPayload: WorkflowRun = {
    ...run,
    context: currentContext,
  };

  // Plan transition deterministically
  const plan = planTransition({
    workflow,
    run: currentRunWithPayload,
    event,
  });

  if (plan.status !== "transition_ready" || !plan.sourceState || !plan.targetState || !plan.selectedTransition) {
    return {
      updatedRun: currentRunWithPayload,
      error: plan.error || `Transition planning failed with status "${plan.status}".`,
      plan,
    };
  }

  const { sourceState, targetState, selectedTransition } = plan;
  const now = env.now();
  let auditTrail = [...currentRunWithPayload.auditTrail];
  let completedActions = currentRunWithPayload.completedActionCount;

  // 1. Record guard evaluations in activity trail
  for (const gRes of plan.guardResults || []) {
    auditTrail.push({
      id: env.createId("AUDIT"),
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: now,
      eventType: "guard_evaluated",
      stateId: sourceState.id,
      actor,
      guardResult: { passed: gRes.passed, reason: gRes.reason },
      metadata: { transitionId: gRes.transitionId, targetStateId: gRes.targetStateId },
    });
  }

  let failedActions = currentRunWithPayload.failedActionCount;

  // 2. Execute Exit Actions of source state
  for (const action of plan.plannedExitActions || []) {
    auditTrail.push({
      id: env.createId("AUDIT"),
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: env.now(),
      eventType: "action_started",
      stateId: sourceState.id,
      actionId: action.id,
      metadata: { actionName: action.name, phase: "exit" },
    });

    const actionRes = executeAction(action, currentContext, env);

    if (actionRes.status === "failure") {
      failedActions += 1;
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "action_failed",
        stateId: sourceState.id,
        actionId: action.id,
        metadata: { actionName: action.name, error: actionRes.error, phase: "exit" },
      });
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "workflow_failed",
        stateId: sourceState.id,
        metadata: { reason: `Exit action "${action.name}" (${action.id}) failed: ${actionRes.error}` },
      });

      return {
        updatedRun: {
          ...currentRunWithPayload,
          status: "failed",
          context: currentContext,
          completedActionCount: completedActions,
          failedActionCount: failedActions,
          auditTrail,
        },
        plan,
      };
    } else {
      completedActions += 1;
      currentContext = applyActionOutputToContext(currentContext, action, actionRes);
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "action_completed",
        stateId: sourceState.id,
        actionId: action.id,
        metadata: { actionName: action.name, output: actionRes.output, phase: "exit" },
      });
    }
  }

  // 3. Execute Transition Actions
  for (const action of plan.plannedTransitionActions || []) {
    auditTrail.push({
      id: env.createId("AUDIT"),
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: env.now(),
      eventType: "action_started",
      stateId: sourceState.id,
      actionId: action.id,
      metadata: { actionName: action.name, phase: "transition" },
    });

    const actionRes = executeAction(action, currentContext, env);

    if (actionRes.status === "failure") {
      failedActions += 1;
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "action_failed",
        stateId: sourceState.id,
        actionId: action.id,
        metadata: { actionName: action.name, error: actionRes.error, phase: "transition" },
      });
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "workflow_failed",
        stateId: sourceState.id,
        metadata: { reason: `Transition action "${action.name}" (${action.id}) failed: ${actionRes.error}` },
      });

      return {
        updatedRun: {
          ...currentRunWithPayload,
          status: "failed",
          context: currentContext,
          completedActionCount: completedActions,
          failedActionCount: failedActions,
          auditTrail,
        },
        plan,
      };
    } else {
      completedActions += 1;
      currentContext = applyActionOutputToContext(currentContext, action, actionRes);
      auditTrail.push({
        id: env.createId("AUDIT"),
        workflowRunId: run.id,
        workflowVersion: workflow.version,
        timestamp: env.now(),
        eventType: "action_completed",
        stateId: sourceState.id,
        actionId: action.id,
        metadata: { actionName: action.name, output: actionRes.output, phase: "transition" },
      });
    }
  }

  // 4. Activity State Exit (Only after all exit and transition actions succeed)
  auditTrail.push({
    id: env.createId("AUDIT"),
    workflowRunId: run.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "state_exited",
    stateId: sourceState.id,
    actor,
    metadata: { nextStateId: targetState.id },
  });

  // 5. Activity Transition Taken
  auditTrail.push({
    id: env.createId("AUDIT"),
    workflowRunId: run.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "transition_taken",
    stateId: sourceState.id,
    actor,
    metadata: {
      fromState: sourceState.name,
      toState: targetState.name,
      event: eventName,
      transitionId: selectedTransition.id,
    },
  });

  // 6. Update history immutably
  const newHistory = currentRunWithPayload.history.map((h) => {
    if (h.stateId === sourceState.id && !h.exitedAt) {
      return { ...h, exitedAt: now, eventTriggered: eventName };
    }
    return h;
  });

  newHistory.push({
    stateId: targetState.id,
    enteredAt: now,
  });

  const visitedStateIds = Array.from(
    new Set([...currentRunWithPayload.visitedStateIds, targetState.id])
  );

  const intermediateRun: WorkflowRun = {
    ...currentRunWithPayload,
    currentStateId: targetState.id,
    context: currentContext,
    history: newHistory,
    visitedStateIds,
    completedActionCount: completedActions,
    lastEventAt: now,
    pendingApproval: undefined,
    status: "active",
    auditTrail,
  };

  // 7. Execute Target State Entry & Active Lifecycle
  const finalRun = executeStateLifecycle(workflow, intermediateRun, targetState, eventName, env);

  return {
    updatedRun: finalRun,
    transitionTaken: selectedTransition,
    plan,
  };
}
