import { ActionDefinition } from "../types/workflow";
import { extractContextValue } from "./guardEvaluator";

export interface ActionExecutionResult {
  actionId: string;
  actionName: string;
  status: "success" | "failure";
  output: Record<string, unknown>;
  error?: string;
  executedAt: string;
}

/**
 * Resolves input variables for an action based on inputMapping and current context
 */
export function resolveActionInputs(
  action: ActionDefinition,
  context: Record<string, unknown>
): Record<string, unknown> {
  if (!action.inputMapping || Object.keys(action.inputMapping).length === 0) {
    return { ...context };
  }

  const inputs: Record<string, unknown> = {};
  for (const [inputKey, contextPath] of Object.entries(action.inputMapping)) {
    inputs[inputKey] = extractContextValue(context, contextPath);
  }
  return inputs;
}

/**
 * Executes an action in simulation mode and produces deterministic output
 */
export function executeAction(
  action: ActionDefinition,
  context: Record<string, unknown>
): ActionExecutionResult {
  const timestamp = new Date().toISOString();
  const inputs = resolveActionInputs(action, context);

  let output: Record<string, unknown> = {};

  switch (action.type) {
    case "agent": {
      const isRiskCheck = action.name.toLowerCase().includes("risk");
      output = {
        riskScore: isRiskCheck ? 15 : 5,
        recommendation: "Automated agent risk check passed successfully.",
        confidence: 0.96,
        agentName: action.agentConfig?.agentName || "Agent Unit",
        executedAt: timestamp,
      };
      break;
    }
    case "http": {
      output = {
        statusCode: 200,
        response: { status: "valid", vendorActive: true, poMatched: true },
        headers: { "content-type": "application/json" },
        durationMs: 120,
        executedAt: timestamp,
      };
      break;
    }
    case "audit": {
      output = {
        auditId: `AUD-${Date.now()}`,
        immutableHash: `sha256-${Math.random().toString(36).substring(2, 10)}`,
        recordedAt: timestamp,
      };
      break;
    }
    case "human_task": {
      output = {
        assigneeRole: action.humanTaskConfig?.assigneeRole || "Approval Lead",
        dueAt: new Date(Date.now() + (action.humanTaskConfig?.dueHours || 24) * 3600000).toISOString(),
        availableDecisions: action.humanTaskConfig?.options || ["APPROVE", "REJECT"],
        requestedAt: timestamp,
      };
      break;
    }
    case "notification": {
      output = {
        recipient: action.humanTaskConfig?.assigneeRole || "Target Stakeholder",
        delivered: true,
        deliveredAt: timestamp,
      };
      break;
    }
    case "transform": {
      output = {
        transformed: true,
        schemaValid: true,
        inputKeysProcessed: Object.keys(inputs),
        transformedAt: timestamp,
      };
      break;
    }
    default: {
      output = {
        status: "completed",
        executedAt: timestamp,
      };
    }
  }

  return {
    actionId: action.id,
    actionName: action.name,
    status: "success",
    output,
    executedAt: timestamp,
  };
}

/**
 * Pure function that maps action execution output into a NEW updated workflow context.
 * Strictly respects explicit outputMapping if present, or falls back to typed default keys.
 */
export function applyActionOutputToContext(
  currentContext: Record<string, unknown>,
  action: ActionDefinition,
  actionResult: ActionExecutionResult
): Record<string, unknown> {
  const newContext: Record<string, any> = JSON.parse(JSON.stringify(currentContext));

  // 1. Explicit outputMapping
  if (action.outputMapping && Object.keys(action.outputMapping).length > 0) {
    for (const [outputKey, targetPath] of Object.entries(action.outputMapping)) {
      const val = actionResult.output[outputKey] ?? actionResult.output;
      let cleanPath = targetPath.trim();
      if (cleanPath.startsWith("$.")) cleanPath = cleanPath.substring(2);
      if (cleanPath.startsWith("$")) cleanPath = cleanPath.substring(1);

      const parts = cleanPath.split(".");
      let curr = newContext;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]] || typeof curr[parts[i]] !== "object") {
          curr[parts[i]] = {};
        }
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = val;
    }
    return newContext;
  }

  // 2. Typed defaults if explicit mapping is absent
  if (action.type === "http" || action.name.toLowerCase().includes("validate")) {
    newContext.validation = {
      schemaValid: true,
      vendorActive: true,
      purchaseOrderOpen: true,
      ...(newContext.validation || {}),
      ...actionResult.output,
    };
  } else if (action.type === "agent" || action.name.toLowerCase().includes("risk")) {
    newContext.analysis = {
      riskScore: actionResult.output.riskScore || 12,
      recommendation: actionResult.output.recommendation || "Low risk verified",
      confidence: actionResult.output.confidence || 0.95,
      ...(newContext.analysis || {}),
    };
  } else if (action.type === "human_task") {
    newContext.approval = {
      status: "pending",
      requestedAt: actionResult.executedAt,
      ...(newContext.approval || {}),
    };
  }

  return newContext;
}
