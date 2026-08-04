import { WorkflowDefinition, ValidationIssue } from "../types/workflow";
import { WorkflowDefinitionSchema } from "./schemas";
import { validateWorkflow } from "./validation";

export interface ParseWorkflowResult {
  success: boolean;
  workflow?: WorkflowDefinition;
  errors: string[];
  issues: ValidationIssue[];
}

/**
 * Single mandatory boundary function for ingesting workflow definitions.
 * Performs normalization, strict Zod schema parsing, and semantic validation.
 */
export function parseWorkflowDefinition(input: unknown): ParseWorkflowResult {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      errors: ["Invalid workflow input: payload must be a non-null JSON object."],
      issues: [
        {
          id: "err-root-input",
          severity: "error",
          message: "Workflow input is not a JSON object.",
        },
      ],
    };
  }

  // 1. Structural Normalization
  const raw = JSON.parse(JSON.stringify(input)) as Record<string, any>;

  if (!raw.id) raw.id = `wf-${Date.now()}`;
  if (!raw.name) raw.name = "Untitled Workflow";
  if (!raw.version) raw.version = "1.0.0";
  if (!raw.status) raw.status = "draft";
  if (!raw.createdAt) raw.createdAt = new Date().toISOString();
  if (!raw.updatedAt) raw.updatedAt = new Date().toISOString();

  // Normalize legacy 'initialState' -> 'initialStateId'
  if (!raw.initialStateId && raw.initialState) {
    raw.initialStateId = typeof raw.initialState === "string" ? raw.initialState : raw.initialState.id;
  }

  if (Array.isArray(raw.states)) {
    for (const state of raw.states) {
      if (!state.entryActions) state.entryActions = [];
      if (!state.activeActions) state.activeActions = [];
      if (!state.exitActions) state.exitActions = [];
      if (!state.transitions) state.transitions = [];

      // Infer sourceStateId on transitions if omitted
      for (const tr of state.transitions) {
        if (!tr.sourceStateId && state.id) {
          tr.sourceStateId = state.id;
        }
      }
    }

    if (!raw.initialStateId) {
      const startSt = raw.states.find((s: any) => s.type === "start");
      if (startSt) raw.initialStateId = startSt.id;
    }
  }

  // 2. Strict Zod Validation
  const zodParse = WorkflowDefinitionSchema.safeParse(raw);
  if (!zodParse.success) {
    const zodErrors = zodParse.error.issues.map(
      (issue) => `Schema Error at [${issue.path.join(".")}]: ${issue.message}`
    );
    const zodIssues: ValidationIssue[] = zodParse.error.issues.map((issue) => ({
      id: `zod-${issue.path.join("-")}`,
      severity: "error",
      field: issue.path.join("."),
      message: `Schema Error at [${issue.path.join(".")}]: ${issue.message}`,
    }));

    return {
      success: false,
      errors: zodErrors,
      issues: zodIssues,
    };
  }

  const parsedWorkflow = zodParse.data as WorkflowDefinition;

  // 3. Comprehensive Semantic Validation
  const issues = validateWorkflow(parsedWorkflow);
  const errorIssues = issues.filter((i) => i.severity === "error");

  if (errorIssues.length > 0) {
    return {
      success: false,
      workflow: parsedWorkflow,
      errors: errorIssues.map((i) => i.message),
      issues,
    };
  }

  return {
    success: true,
    workflow: parsedWorkflow,
    errors: [],
    issues,
  };
}
