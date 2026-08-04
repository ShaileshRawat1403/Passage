import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowRun,
  TransitionDefinition,
  ActionDefinition,
  WorkflowEvent,
} from "../types/workflow";
import { evaluateGuard } from "./guardEvaluator";

export type TransitionPlanStatus =
  | "transition_ready"
  | "ambiguous"
  | "blocked"
  | "no_transition_found"
  | "invalid_state"
  | "terminal_state";

export interface GuardEvaluationRecord {
  transitionId: string;
  targetStateId: string;
  passed: boolean;
  reason: string;
}

export interface TransitionPlanResult {
  status: TransitionPlanStatus;
  eventName: string;
  sourceState?: WorkflowState;
  targetState?: WorkflowState;
  selectedTransition?: TransitionDefinition;
  candidateTransitions?: TransitionDefinition[];
  eligibleTransitions?: TransitionDefinition[];
  guardResults?: GuardEvaluationRecord[];
  error?: string;
  plannedExitActions?: ActionDefinition[];
  plannedTransitionActions?: ActionDefinition[];
  plannedEntryActions?: ActionDefinition[];
  plannedActiveActions?: ActionDefinition[];
}

/**
 * Pure transition planner for Passage state machine engine.
 * Deterministically evaluates candidate transitions and guards without mutating run or executing side effects.
 */
export function planTransition(params: {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  event: WorkflowEvent | string;
}): TransitionPlanResult {
  const { workflow, run, event } = params;
  const eventName = typeof event === "string" ? event : event.type;

  // 1. Check run lifecycle status
  if (run.status === "completed" || run.status === "failed") {
    return {
      status: "terminal_state",
      eventName,
      error: `Workflow run is already in terminal status "${run.status}". No further transitions allowed.`,
    };
  }

  // 2. Resolve source state
  const sourceState = workflow.states.find((s) => s.id === run.currentStateId);
  if (!sourceState) {
    return {
      status: "invalid_state",
      eventName,
      error: `Current state ID "${run.currentStateId}" does not exist in workflow definition.`,
    };
  }

  if (sourceState.type === "final") {
    return {
      status: "terminal_state",
      eventName,
      sourceState,
      error: `State "${sourceState.name}" is a terminal state and cannot produce transitions.`,
    };
  }

  // 3. Find candidate transitions matching event
  const candidates = (sourceState.transitions || []).filter((t) => {
    if (!t.event || t.event.trim() === "") return sourceState.type === "decision";
    return t.event === eventName || t.event === "*";
  });

  if (candidates.length === 0) {
    return {
      status: "no_transition_found",
      eventName,
      sourceState,
      candidateTransitions: [],
      error: `No transition registered in state "${sourceState.name}" for trigger event "${eventName}".`,
    };
  }

  // 4. Evaluate guards for all candidate transitions
  const guardResults: GuardEvaluationRecord[] = [];
  const eligibleTransitions: TransitionDefinition[] = [];

  for (const candidate of candidates) {
    const evalRes = evaluateGuard(candidate.guard, run.context);
    guardResults.push({
      transitionId: candidate.id,
      targetStateId: candidate.targetStateId,
      passed: evalRes.passed,
      reason: evalRes.reason,
    });

    if (evalRes.passed) {
      eligibleTransitions.push(candidate);
    }
  }

  if (eligibleTransitions.length === 0) {
    return {
      status: "blocked",
      eventName,
      sourceState,
      candidateTransitions: candidates,
      guardResults,
      error: `Transitions evaluated for event "${eventName}", but all transition guards blocked.`,
    };
  }

  // 5. Deterministic priority sorting & ambiguity detection
  // Sort descending by priority (default priority is 0)
  eligibleTransitions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const highestPriority = eligibleTransitions[0].priority || 0;
  const topPriorityMatches = eligibleTransitions.filter(
    (t) => (t.priority || 0) === highestPriority
  );

  // Rejection rule for non-deterministic ambiguity
  if (topPriorityMatches.length > 1) {
    const transitionIds = topPriorityMatches.map((t) => `"${t.id}" -> ${t.targetStateId}`).join(", ");
    return {
      status: "ambiguous",
      eventName,
      sourceState,
      candidateTransitions: candidates,
      eligibleTransitions,
      guardResults,
      error: `Ambiguous transition selection: ${topPriorityMatches.length} eligible transitions (${transitionIds}) share the highest priority (${highestPriority}) for event "${eventName}". Assign distinct priority levels to ensure deterministic execution.`,
    };
  }

  const selectedTransition = topPriorityMatches[0];
  const targetState = workflow.states.find((s) => s.id === selectedTransition.targetStateId);

  if (!targetState) {
    return {
      status: "invalid_state",
      eventName,
      sourceState,
      selectedTransition,
      error: `Target state ID "${selectedTransition.targetStateId}" referenced by transition "${selectedTransition.id}" does not exist.`,
    };
  }

  // 6. Plan lifecycle actions
  return {
    status: "transition_ready",
    eventName,
    sourceState,
    targetState,
    selectedTransition,
    candidateTransitions: candidates,
    eligibleTransitions,
    guardResults,
    plannedExitActions: sourceState.exitActions || [],
    plannedTransitionActions: selectedTransition.actions || [],
    plannedEntryActions: targetState.entryActions || [],
    plannedActiveActions: targetState.activeActions || [],
  };
}
