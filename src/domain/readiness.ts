import { WorkflowDefinition, WorkflowReadiness } from "../types/workflow";
import { parseWorkflowDefinition } from "./parser";
import { validateWorkflow } from "./validation";

/**
 * Derives workflow readiness (incomplete, structurally_valid, executable)
 * without circular dependencies between parser and validation.
 */
export function getWorkflowReadiness(workflow: WorkflowDefinition): WorkflowReadiness {
  const parseResult = parseWorkflowDefinition(workflow);
  if (!parseResult.success) {
    return "incomplete";
  }

  const issues = validateWorkflow(workflow);
  const hasErrors = issues.some((i) => i.severity === "error");
  if (hasErrors) {
    return "incomplete";
  }

  const hasPlaceholders = (workflow.states || []).some((st) =>
    (st.transitions || []).some(
      (tr) => !tr.event || tr.event === "EVENT_REQUIRED" || tr.event === "NEXT_EVENT"
    )
  );

  const hasWarnings = issues.some((i) => i.severity === "warning");

  if (hasPlaceholders || hasWarnings) {
    return "structurally_valid";
  }

  return "executable";
}
