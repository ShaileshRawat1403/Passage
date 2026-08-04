import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowRun,
  AuditEvent,
  WorkflowEvent,
  TransitionDefinition,
} from "../types/workflow";
import { planTransition, TransitionPlanResult } from "./planner";
import { executeAction, applyActionOutputToContext } from "./actionExecutor";

/**
 * Pure, immutable factory that initializes a new workflow execution run
 */
export function createWorkflowRun(
  workflow: WorkflowDefinition,
  initialContext: Record<string, unknown> = {},
  customCaseId?: string
): WorkflowRun {
  const caseId = customCaseId || `CASE-${Date.now().toString().slice(-6)}`;
  const runId = `RUN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const now = new Date().toISOString();

  const startState =
    workflow.states.find((s) => s.id === workflow.initialStateId) ||
    workflow.states.find((s) => s.type === "start") ||
    workflow.states[0];

  const mergedContext = {
    caseId,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    ...(workflow.defaultContext || {}),
    ...initialContext,
  };

  const initialAudit: AuditEvent = {
    id: `AUDIT-${Date.now()}-1`,
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
  return executeStateLifecycle(workflow, initialRun, startState, "WORKFLOW_STARTED");
}

/**
 * Pure function that processes entry and active actions for a state and produces an immutable updated run.
 */
export function executeStateLifecycle(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  state: WorkflowState,
  triggerEvent: string
): WorkflowRun {
  const now = new Date().toISOString();
  let currentContext = { ...run.context };
  let auditTrail = [...run.auditTrail];
  let completedActions = run.completedActionCount;

  // 1. Audit State Entry
  auditTrail.push({
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    workflowRunId: run.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "state_entered",
    stateId: state.id,
    metadata: { triggerEvent, stateName: state.name },
  });

  // 2. Execute Entry Actions
  for (const action of state.entryActions || []) {
    const actionRes = executeAction(action, currentContext);
    completedActions += 1;
    currentContext = applyActionOutputToContext(currentContext, action, actionRes);

    auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "action_completed",
      stateId: state.id,
      actionId: action.id,
      metadata: { actionName: action.name, output: actionRes.output },
    });
  }

  // 3. Execute Active Actions
  for (const action of state.activeActions || []) {
    const actionRes = executeAction(action, currentContext);
    completedActions += 1;
    currentContext = applyActionOutputToContext(currentContext, action, actionRes);

    auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "action_completed",
      stateId: state.id,
      actionId: action.id,
      metadata: { actionName: action.name, output: actionRes.output },
    });
  }

  // Determine updated run status
  let newStatus = run.status;
  let completedAt = run.completedAt;
  let pendingApproval = run.pendingApproval;

  if (state.type === "final") {
    newStatus = "completed";
    completedAt = new Date().toISOString();
    auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      const dueAt = new Date(Date.now() + dueHours * 3600 * 1000).toISOString();

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
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
  actor: string = "User Operator"
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
  const now = new Date().toISOString();
  let auditTrail = [...currentRunWithPayload.auditTrail];
  let completedActions = currentRunWithPayload.completedActionCount;

  // 1. Record guard evaluations in audit trail
  for (const gRes of plan.guardResults || []) {
    auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

  // 2. Execute Exit Actions of source state
  for (const action of plan.plannedExitActions || []) {
    const actionRes = executeAction(action, currentContext);
    completedActions += 1;
    currentContext = applyActionOutputToContext(currentContext, action, actionRes);

    auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "action_completed",
      stateId: sourceState.id,
      actionId: action.id,
      metadata: { actionName: action.name, output: actionRes.output, phase: "exit" },
    });
  }

  // 3. Audit State Exit
  auditTrail.push({
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    workflowRunId: run.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "state_exited",
    stateId: sourceState.id,
    actor,
    metadata: { nextStateId: targetState.id },
  });

  // 4. Execute Transition Actions
  for (const action of plan.plannedTransitionActions || []) {
    const actionRes = executeAction(action, currentContext);
    completedActions += 1;
    currentContext = applyActionOutputToContext(currentContext, action, actionRes);

    auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: run.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "action_completed",
      stateId: sourceState.id,
      actionId: action.id,
      metadata: { actionName: action.name, output: actionRes.output, phase: "transition" },
    });
  }

  // 5. Audit Transition Taken
  auditTrail.push({
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
  const finalRun = executeStateLifecycle(workflow, intermediateRun, targetState, eventName);

  return {
    updatedRun: finalRun,
    transitionTaken: selectedTransition,
    plan,
  };
}
