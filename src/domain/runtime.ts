import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowRun,
  AuditEvent,
  WorkflowEvent,
  TransitionDefinition,
  ActionDefinition,
} from "../types/workflow";
import { evaluateGuard } from "./guardEvaluator";

/**
 * Creates a fresh workflow execution run
 */
export function createWorkflowRun(
  workflow: WorkflowDefinition,
  initialContext: Record<string, any> = {},
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
    actor: "System Runtime",
    stateId: startState.id,
    metadata: { initialContext: mergedContext },
  };

  const run: WorkflowRun = {
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

  // Run initial state actions
  return executeStateLifecycle(workflow, run, startState, "WORKFLOW_STARTED");
}

/**
 * Executes a state's lifecycle (Entry -> Active actions)
 */
export function executeStateLifecycle(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  state: WorkflowState,
  triggerEvent: string
): WorkflowRun {
  const now = new Date().toISOString();
  let updatedRun = { ...run };
  const context = { ...updatedRun.context };

  // 1. Audit State Entry
  const entryAudit: AuditEvent = {
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    workflowRunId: updatedRun.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "state_entered",
    stateId: state.id,
    metadata: { triggerEvent, stateName: state.name },
  };
  updatedRun.auditTrail = [...updatedRun.auditTrail, entryAudit];

  // 2. Execute Entry Actions
  for (const action of state.entryActions || []) {
    const actionResult = executeMockAction(action, context);
    updatedRun.completedActionCount += 1;
    applyActionOutputToContext(context, action, actionResult);

    updatedRun.auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: updatedRun.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "action_completed",
      stateId: state.id,
      actionId: action.id,
      metadata: { actionName: action.name, output: actionResult },
    });
  }

  // 3. Execute Active Actions
  for (const action of state.activeActions || []) {
    const actionResult = executeMockAction(action, context);
    updatedRun.completedActionCount += 1;
    applyActionOutputToContext(context, action, actionResult);

    updatedRun.auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: updatedRun.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "action_completed",
      stateId: state.id,
      actionId: action.id,
      metadata: { actionName: action.name, output: actionResult },
    });
  }

  updatedRun.context = context;

  // 4. Update status based on state type
  if (state.type === "final") {
    updatedRun.status = "completed";
    updatedRun.completedAt = new Date().toISOString();
    updatedRun.auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: updatedRun.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "workflow_completed",
      stateId: state.id,
      metadata: { finalState: state.name },
    });
  } else if (state.type === "waiting" || state.type === "approval") {
    updatedRun.status = "waiting";

    if (state.type === "approval") {
      const humanTask = [...state.entryActions, ...state.activeActions].find(
        (a) => a.type === "human_task"
      );
      const role = humanTask?.humanTaskConfig?.assigneeRole || "Finance Manager";
      const dueHours = humanTask?.humanTaskConfig?.dueHours || 24;
      const dueAt = new Date(Date.now() + dueHours * 3600 * 1000).toISOString();

      updatedRun.pendingApproval = {
        assigneeRole: role,
        requestedAt: now,
        dueAt,
        availableDecisions: humanTask?.humanTaskConfig?.options || [
          "APPROVE",
          "REJECT",
          "REQUEST_CHANGES",
        ],
      };

      updatedRun.auditTrail.push({
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        workflowRunId: updatedRun.id,
        workflowVersion: workflow.version,
        timestamp: now,
        eventType: "human_approval_requested",
        stateId: state.id,
        actor: role,
        metadata: { dueAt, choices: updatedRun.pendingApproval.availableDecisions },
      });
    }
  }

  return updatedRun;
}

/**
 * Dispatches an event to an active workflow run and triggers deterministic transitions
 */
export function dispatchWorkflowEvent(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  event: WorkflowEvent | string,
  actor: string = "User Operator"
): { updatedRun: WorkflowRun; transitionTaken?: TransitionDefinition; error?: string } {
  const eventName = typeof event === "string" ? event : event.type;
  const eventPayload = typeof event === "object" ? event.payload : {};

  let updatedRun = { ...run };
  if (eventPayload && Object.keys(eventPayload).length > 0) {
    updatedRun.context = { ...updatedRun.context, ...eventPayload };
  }

  const currentState = workflow.states.find((s) => s.id === updatedRun.currentStateId);
  if (!currentState) {
    return { updatedRun, error: `Current state ID "${updatedRun.currentStateId}" not found.` };
  }

  if (updatedRun.status === "completed" || updatedRun.status === "failed") {
    return { updatedRun, error: `Workflow run is already ${updatedRun.status}.` };
  }

  // Find candidate transitions matching event
  const candidates = (currentState.transitions || []).filter(
    (t) => t.event === eventName || t.event === "*" || !t.event
  );

  if (candidates.length === 0) {
    return {
      updatedRun,
      error: `No transition found in state "${currentState.name}" for event "${eventName}".`,
    };
  }

  // Sort candidates by priority (higher priority number first)
  candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Evaluate guards in deterministic priority order
  let selectedTransition: TransitionDefinition | undefined;
  let guardEvalReason = "";

  for (const candidate of candidates) {
    const evalRes = evaluateGuard(candidate.guard, updatedRun.context);

    // Audit Guard Evaluation
    updatedRun.auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workflowRunId: updatedRun.id,
      workflowVersion: workflow.version,
      timestamp: new Date().toISOString(),
      eventType: "guard_evaluated",
      stateId: currentState.id,
      actor,
      guardResult: evalRes,
      metadata: { transitionId: candidate.id, targetStateId: candidate.targetStateId },
    });

    if (evalRes.passed) {
      selectedTransition = candidate;
      guardEvalReason = evalRes.reason;
      break;
    }
  }

  if (!selectedTransition) {
    return {
      updatedRun,
      error: `Transitions evaluated for event "${eventName}", but all guards blocked.`,
    };
  }

  // Transition selected! Execute transition step
  const targetState = workflow.states.find((s) => s.id === selectedTransition.targetStateId);
  if (!targetState) {
    return { updatedRun, error: `Target state "${selectedTransition.targetStateId}" does not exist.` };
  }

  const now = new Date().toISOString();

  // 1. Exit Actions of current state
  for (const action of currentState.exitActions || []) {
    const res = executeMockAction(action, updatedRun.context);
    applyActionOutputToContext(updatedRun.context, action, res);
  }

  // 2. Audit State Exit
  updatedRun.auditTrail.push({
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    workflowRunId: updatedRun.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "state_exited",
    stateId: currentState.id,
    actor,
    metadata: { nextStateId: targetState.id },
  });

  // 3. Audit Transition Taken
  updatedRun.auditTrail.push({
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    workflowRunId: updatedRun.id,
    workflowVersion: workflow.version,
    timestamp: now,
    eventType: "transition_taken",
    stateId: currentState.id,
    actor,
    metadata: {
      fromState: currentState.name,
      toState: targetState.name,
      event: eventName,
      guardReason: guardEvalReason,
    },
  });

  // 4. Update History and state pointers
  const historyIndex = updatedRun.history.findIndex((h) => h.stateId === currentState.id && !h.exitedAt);
  if (historyIndex >= 0) {
    updatedRun.history[historyIndex].exitedAt = now;
    updatedRun.history[historyIndex].eventTriggered = eventName;
  }

  updatedRun.history.push({
    stateId: targetState.id,
    enteredAt: now,
  });

  if (!updatedRun.visitedStateIds.includes(targetState.id)) {
    updatedRun.visitedStateIds.push(targetState.id);
  }

  updatedRun.currentStateId = targetState.id;
  updatedRun.lastEventAt = now;
  updatedRun.pendingApproval = undefined;
  updatedRun.status = "active";

  // 5. Execute target state entry & active actions
  updatedRun = executeStateLifecycle(workflow, updatedRun, targetState, eventName);

  return { updatedRun, transitionTaken: selectedTransition };
}

/**
 * Executes a single mock action and returns state payload
 */
export function executeMockAction(action: ActionDefinition, context: Record<string, any>): Record<string, any> {
  const timestamp = new Date().toISOString();

  switch (action.type) {
    case "agent":
      return {
        riskScore: Math.floor(Math.random() * 25) + 5,
        confidence: 0.96,
        recommendation: "Low risk verified by automated AI agent audit.",
        executedAt: timestamp,
      };
    case "http":
      return {
        statusCode: 200,
        response: { status: "valid", vendorActive: true, poMatched: true },
        durationMs: 142,
        executedAt: timestamp,
      };
    case "audit":
      return {
        auditId: `AUD-${Date.now()}`,
        immutableHash: `sha256-${Math.random().toString(36).substring(2, 10)}`,
        timestamp,
      };
    case "human_task":
      return {
        assignedRole: action.humanTaskConfig?.assigneeRole || "Reviewer",
        status: "pending",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      };
    case "notification":
      return {
        recipient: action.humanTaskConfig?.assigneeRole || "Finance Team",
        sent: true,
        sentAt: timestamp,
      };
    case "transform":
      return {
        transformed: true,
        schemaValid: true,
      };
    default:
      return {
        status: "completed",
        executedAt: timestamp,
      };
  }
}

/**
 * Applies action output into workflow context
 */
export function applyActionOutputToContext(
  context: Record<string, any>,
  action: ActionDefinition,
  actionResult: Record<string, any>
) {
  if (action.type === "http" || action.name.toLowerCase().includes("validate")) {
    context.validation = {
      schemaValid: true,
      vendorActive: true,
      purchaseOrderOpen: true,
      ...(context.validation || {}),
      ...actionResult,
    };
  } else if (action.type === "agent" || action.name.toLowerCase().includes("risk")) {
    context.analysis = {
      riskScore: actionResult.riskScore || 12,
      recommendation: actionResult.recommendation || "Low risk",
      confidence: actionResult.confidence || 0.95,
      ...(context.analysis || {}),
    };
  } else if (action.type === "human_task") {
    context.approval = {
      status: "pending",
      requestedAt: actionResult.executedAt || new Date().toISOString(),
      ...(context.approval || {}),
    };
  }
}

