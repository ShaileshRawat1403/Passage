import { WorkflowDefinition, ValidationIssue, ActionDefinition } from "../types/workflow";
import { WorkflowDefinitionSchema } from "./schemas";

/**
 * Validates a workflow definition deterministically and comprehensively
 */
export function validateWorkflow(workflow: WorkflowDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 0. Schema Validation via Zod
  const zodResult = WorkflowDefinitionSchema.safeParse(workflow);
  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      issues.push({
        id: `zod-err-${issue.path.join("-")}`,
        severity: "error",
        field: issue.path.join("."),
        message: `Schema violation at [${issue.path.join(".")}]: ${issue.message}`,
      });
    }
  }

  const states = workflow.states || [];
  const stateMap = new Map<string, typeof states[0]>();
  const transitionIds = new Set<string>();
  const actionIds = new Set<string>();
  const compensationIds = new Set<string>();

  // Check duplicate state IDs
  for (const st of states) {
    if (stateMap.has(st.id)) {
      issues.push({
        id: `err-duplicate-state-${st.id}`,
        severity: "error",
        stateId: st.id,
        message: `Duplicate state ID detected: "${st.id}". Every state ID must be unique.`,
      });
    } else {
      stateMap.set(st.id, st);
    }
  }

  // 1. Check start state invariant
  const startStates = states.filter((s) => s.type === "start");
  if (startStates.length === 0) {
    issues.push({
      id: "err-no-start",
      severity: "error",
      message: "Workflow has no Start state.",
    });
  } else if (startStates.length > 1) {
    issues.push({
      id: "err-multi-start",
      severity: "error",
      message: `Workflow has ${startStates.length} start states. Exactly 1 start state is required.`,
    });
  }

  // Check initial state reference
  if (workflow.initialStateId) {
    const initSt = stateMap.get(workflow.initialStateId);
    if (!initSt) {
      issues.push({
        id: "err-invalid-initial-state",
        severity: "error",
        message: `Initial state ID "${workflow.initialStateId}" does not exist in workflow states.`,
      });
    } else if (initSt.type !== "start") {
      issues.push({
        id: "err-initial-state-not-start",
        severity: "error",
        stateId: initSt.id,
        message: `Initial state "${workflow.initialStateId}" must be of type "start", but found "${initSt.type}".`,
      });
    }

    const firstStart = startStates[0];
    if (startStates.length === 1 && firstStart && firstStart.id !== workflow.initialStateId) {
      issues.push({
        id: "err-initial-start-mismatch",
        severity: "error",
        message: `Workflow initialStateId ("${workflow.initialStateId}") does not match the single Start state ID ("${firstStart.id}").`,
      });
    }
  }

  // 2. Check final states
  const finalStates = states.filter((s) => s.type === "final");
  if (finalStates.length === 0) {
    issues.push({
      id: "err-no-final",
      severity: "error",
      message: "Workflow must contain at least one Final state (e.g., Completed or Rejected).",
    });
  }

  // Collect and validate all actions
  const validateAction = (act: ActionDefinition, stateId: string, context: string) => {
    if (!act.id) {
      issues.push({
        id: `err-action-no-id-${stateId}-${context}`,
        severity: "error",
        stateId,
        message: `Action in ${context} of state "${stateId}" is missing an ID.`,
      });
      return;
    }

    if (actionIds.has(act.id)) {
      issues.push({
        id: `err-duplicate-action-${act.id}`,
        severity: "error",
        stateId,
        message: `Duplicate action ID detected: "${act.id}". Every action ID must be globally unique.`,
      });
    } else {
      actionIds.add(act.id);
    }

    if (act.compensationActionId) {
      compensationIds.add(act.compensationActionId);
    }

    // Action-type specific config check
    if (act.type === "http" && !act.httpConfig) {
      issues.push({
        id: `err-action-missing-http-config-${act.id}`,
        severity: "error",
        stateId,
        message: `HTTP Action "${act.name || act.id}" is missing required httpConfig.`,
      });
    }
    if (act.type === "agent" && !act.agentConfig) {
      issues.push({
        id: `err-action-missing-agent-config-${act.id}`,
        severity: "error",
        stateId,
        message: `Agent Action "${act.name || act.id}" is missing required agentConfig.`,
      });
    }
    if (act.type === "human_task" && !act.humanTaskConfig) {
      issues.push({
        id: `err-action-missing-human-config-${act.id}`,
        severity: "error",
        stateId,
        message: `Human Task Action "${act.name || act.id}" is missing required humanTaskConfig.`,
      });
    }
  };

  // 3. Inspect individual states
  for (const state of states) {
    const transitions = state.transitions || [];

    // Check state actions
    (state.entryActions || []).forEach((a) => validateAction(a, state.id, "entryActions"));
    (state.activeActions || []).forEach((a) => validateAction(a, state.id, "activeActions"));
    (state.exitActions || []).forEach((a) => validateAction(a, state.id, "exitActions"));

    // Check state timeout target
    if (state.timeout?.targetStateId && !stateMap.has(state.timeout.targetStateId)) {
      issues.push({
        id: `err-timeout-target-missing-${state.id}`,
        severity: "error",
        stateId: state.id,
        message: `Timeout policy in state "${state.name}" points to non-existent target state "${state.timeout.targetStateId}".`,
      });
    }

    // Check parallel policy required actions
    if (state.type === "parallel" && state.parallelPolicy?.requiredActionIds) {
      const stateActionIds = new Set([
        ...(state.entryActions || []),
        ...(state.activeActions || []),
        ...(state.exitActions || []),
      ].map((a) => a.id).filter(Boolean));

      for (const reqId of state.parallelPolicy.requiredActionIds) {
        if (!stateActionIds.has(reqId)) {
          issues.push({
            id: `err-parallel-req-action-missing-${state.id}-${reqId}`,
            severity: "error",
            stateId: state.id,
            message: `Parallel policy in state "${state.name}" requires action "${reqId}", but this action is not defined within state "${state.name}".`,
          });
        }
      }
    }

    // Final states should not have outgoing transitions
    if (state.type === "final" && transitions.length > 0) {
      issues.push({
        id: `err-final-outgoing-${state.id}`,
        severity: "error",
        stateId: state.id,
        message: `Final state "${state.name}" cannot have outgoing transitions.`,
      });
    }

    // Non-final states must have outgoing transitions
    if (state.type !== "final" && transitions.length === 0) {
      issues.push({
        id: `err-no-outgoing-${state.id}`,
        severity: "error",
        stateId: state.id,
        message: `State "${state.name}" has no outgoing transitions. Workflow will stall when entering this state.`,
      });
    }

    // Detect equal-priority ambiguity in outgoing transitions
    const eventGroupMap = new Map<string, typeof transitions>();
    for (const tr of transitions) {
      if (tr.event) {
        const group = eventGroupMap.get(tr.event) || [];
        group.push(tr);
        eventGroupMap.set(tr.event, group);
      }
    }

    for (const [evt, trList] of eventGroupMap.entries()) {
      if (trList.length > 1) {
        const priorities = trList.map((t) => t.priority ?? 0);
        const maxP = Math.max(...priorities);
        const topCount = priorities.filter((p) => p === maxP).length;
        if (topCount > 1) {
          issues.push({
            id: `err-ambiguous-transitions-${state.id}-${evt}`,
            severity: "error",
            stateId: state.id,
            message: `State "${state.name}" has ${topCount} transitions for event "${evt}" with identical highest priority (${maxP}). This creates ambiguous non-deterministic transition selection.`,
          });
        }
      }
    }

    // Check individual transitions
    for (const transition of transitions) {
      if (transition.id) {
        if (transitionIds.has(transition.id)) {
          issues.push({
            id: `err-duplicate-transition-${transition.id}`,
            severity: "error",
            stateId: state.id,
            transitionId: transition.id,
            message: `Duplicate transition ID detected: "${transition.id}". Transition IDs must be unique.`,
          });
        } else {
          transitionIds.add(transition.id);
        }
      }

      if (transition.sourceStateId && transition.sourceStateId !== state.id) {
        issues.push({
          id: `err-transition-source-mismatch-${transition.id}`,
          severity: "error",
          stateId: state.id,
          transitionId: transition.id,
          message: `Transition "${transition.id}" in state "${state.id}" specifies sourceStateId "${transition.sourceStateId}" which does not match containing state.`,
        });
      }

      (transition.actions || []).forEach((a) => validateAction(a, state.id, `transition:${transition.id}`));

      if (!transition.targetStateId) {
        issues.push({
          id: `err-transition-no-target-${transition.id}`,
          severity: "error",
          stateId: state.id,
          transitionId: transition.id,
          message: `Transition in state "${state.name}" is missing a target state.`,
        });
      } else if (!stateMap.has(transition.targetStateId)) {
        issues.push({
          id: `err-transition-missing-target-${transition.id}`,
          severity: "error",
          stateId: state.id,
          transitionId: transition.id,
          message: `Transition in state "${state.name}" points to non-existent target state "${transition.targetStateId}".`,
        });
      }

      if (!transition.event && state.type !== "decision") {
        issues.push({
          id: `warn-transition-no-event-${transition.id}`,
          severity: "warning",
          stateId: state.id,
          transitionId: transition.id,
          message: `Transition to "${transition.targetStateId}" has no trigger event specified.`,
        });
      }
    }

    // Approval state validation
    if (state.type === "approval") {
      const allActions = [...state.entryActions, ...state.activeActions];
      const hasHumanTask = allActions.some((a) => a.type === "human_task" || a.type === "notification");
      if (!hasHumanTask) {
        issues.push({
          id: `warn-approval-no-task-${state.id}`,
          severity: "warning",
          stateId: state.id,
          message: `Human Approval state "${state.name}" should configure an approval action or notification.`,
        });
      }
    }

    // Waiting state validation
    if (state.type === "waiting") {
      if (!state.timeout && !transitions.some((t) => t.event.includes("TIMEOUT"))) {
        issues.push({
          id: `warn-waiting-no-timeout-${state.id}`,
          severity: "warning",
          stateId: state.id,
          message: `Waiting state "${state.name}" has no timeout rule or fallback event defined.`,
        });
      }
    }
  }

  // Verify referenced compensation actions exist
  for (const compId of compensationIds) {
    if (!actionIds.has(compId)) {
      issues.push({
        id: `err-missing-compensation-action-${compId}`,
        severity: "error",
        message: `Referenced compensation action ID "${compId}" does not exist in any state action or transition action.`,
      });
    }
  }

  // 4. Unreachable states detection
  const firstStart = startStates[0];
  if (startStates.length === 1 && firstStart) {
    const startId = firstStart.id;
    const visited = new Set<string>();

    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const st = stateMap.get(id);
      if (!st) return;
      for (const tr of st.transitions || []) {
        if (tr.targetStateId) dfs(tr.targetStateId);
      }
    };

    dfs(startId);

    for (const state of states) {
      if (!visited.has(state.id)) {
        issues.push({
          id: `warn-unreachable-${state.id}`,
          severity: "warning",
          stateId: state.id,
          message: `State "${state.name}" is unreachable from Start state.`,
        });
      }
    }
  }

  return issues;
}
