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
  let raw = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  
  if (raw.contract === "passage.workflow-document.v1" && raw.workflow) {
    const layout = raw.layout || {};
    raw = raw.workflow as Record<string, unknown>;
    
    // Inject layout positions back into the states
    if (Array.isArray(raw.states)) {
      raw.states.forEach((state: any) => {
        if (state.id && layout[state.id]) {
          state.position = layout[state.id].position;
        }
      });
    }
  }

  if (!raw.id) raw.id = `wf-${Date.now()}`;
  if (!raw.name) raw.name = "Untitled Workflow";
  if (!raw.version) raw.version = "1.0.0";
  if (!raw.status) raw.status = "draft";
  if (!raw.createdAt) raw.createdAt = new Date().toISOString();
  if (!raw.updatedAt) raw.updatedAt = new Date().toISOString();

  // Normalize legacy 'initialState' -> 'initialStateId'
  if (raw.initialState) {
    const initialStateObj = raw.initialState as string | { id?: string };
    const normalizedInitialState =
      typeof initialStateObj === "string" ? initialStateObj : initialStateObj.id;
    if (!raw.initialStateId) {
      raw.initialStateId = normalizedInitialState;
    }
    delete raw.initialState;
  }

  // Remove top-level extra metadata fields (e.g. questions from AI endpoint)
  if ("questions" in raw) {
    delete raw.questions;
  }

  if (Array.isArray(raw.states)) {
    const statesList = raw.states as Array<Record<string, unknown>>;
    for (const state of statesList) {
      if (!state.entryActions) state.entryActions = [];
      if (!state.activeActions) state.activeActions = [];
      if (!state.exitActions) state.exitActions = [];
      if (!state.transitions) state.transitions = [];

      // Infer sourceStateId on transitions if omitted
      if (Array.isArray(state.transitions)) {
        for (const tr of state.transitions as Array<Record<string, unknown>>) {
          if (!tr.sourceStateId && state.id) {
            tr.sourceStateId = state.id;
          }
        }
      }
    }

    if (!raw.initialStateId) {
      const startSt = statesList.find((s) => s.type === "start");
      if (startSt && startSt.id) raw.initialStateId = startSt.id;
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
