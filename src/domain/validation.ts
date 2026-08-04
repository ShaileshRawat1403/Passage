import { WorkflowDefinition, ValidationIssue } from "../types/workflow";
import { WorkflowDefinitionSchema } from "./schemas";

/**
 * Validates a workflow definition deterministically
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

  // 1. Check start state
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
  if (workflow.initialStateId && !stateMap.has(workflow.initialStateId)) {
    issues.push({
      id: "err-invalid-initial-state",
      severity: "error",
      message: `Initial state ID "${workflow.initialStateId}" does not exist in workflow states.`,
    });
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

  // 3. Inspect individual states
  for (const state of states) {
    const transitions = state.transitions || [];

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

    // Check transition targets
    for (const transition of transitions) {
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

      // Check event trigger
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

    // Action complexity warning
    const totalActions = state.entryActions.length + state.activeActions.length + state.exitActions.length;
    if (totalActions > 7) {
      issues.push({
        id: `warn-too-many-actions-${state.id}`,
        severity: "warning",
        stateId: state.id,
        message: `State "${state.name}" contains ${totalActions} actions (>7). Consider breaking down into a subflow or parallel state.`,
      });
    }

    if (transitions.length > 5) {
      issues.push({
        id: `warn-too-many-transitions-${state.id}`,
        severity: "warning",
        stateId: state.id,
        message: `State "${state.name}" has ${transitions.length} outgoing transitions (>5). Consider using a Decision state.`,
      });
    }
  }

  // 4. Unreachable states detection
  if (startStates.length === 1) {
    const startId = startStates[0].id;
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
