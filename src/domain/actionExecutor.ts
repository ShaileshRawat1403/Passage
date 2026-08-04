import { ActionDefinition } from "../types/workflow";
import { extractContextValue } from "./guardEvaluator";
import { RuntimeEnvironment, defaultProductionEnv } from "./runtimeEnvironment";

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
 * Executes an action in simulation or custom mode and produces deterministic output
 */
export function executeAction(
  action: ActionDefinition,
  context: Record<string, unknown>,
  env: RuntimeEnvironment = defaultProductionEnv
): ActionExecutionResult {
  const timestamp = env.now();
  try {
    if (env.executeAction) {
      return env.executeAction(action, context, env);
    }

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
          auditId: env.createId("AUD"),
          immutableHash: `sha256-test-hash`,
          recordedAt: timestamp,
        };
        break;
      }
      case "human_task": {
        output = {
          assigneeRole: action.humanTaskConfig?.assigneeRole || "Approval Lead",
          dueAt: timestamp,
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      actionId: action.id,
      actionName: action.name,
      status: "failure",
      error: errorMsg,
      output: {},
      executedAt: timestamp,
    };
  }
}

/**
 * Pure function that maps action execution output into a NEW updated workflow context.
 * STRICT: Requires explicit outputMapping to modify workflow context.
 * Actions without outputMapping return currentContext completely unmodified.
 */
export function applyActionOutputToContext(
  currentContext: Record<string, unknown>,
  action: ActionDefinition,
  actionResult: ActionExecutionResult
): Record<string, unknown> {
  // If explicit outputMapping is not defined or empty, DO NOT modify context!
  if (!action.outputMapping || Object.keys(action.outputMapping).length === 0) {
    return currentContext;
  }

  const newContext: Record<string, any> = JSON.parse(JSON.stringify(currentContext));

  for (const [outputKey, targetPath] of Object.entries(action.outputMapping)) {
    const val = actionResult.output[outputKey] ?? actionResult.output;
    let cleanPath = targetPath.trim();
    if (cleanPath.startsWith("$.")) cleanPath = cleanPath.substring(2);
    if (cleanPath.startsWith("$")) cleanPath = cleanPath.substring(1);

    const parts = cleanPath.split(".");
    let curr = newContext;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;
      if (!curr[part] || typeof curr[part] !== "object") {
        curr[part] = {};
      }
      curr = curr[part];
    }
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      curr[lastPart] = val;
    }
  }

  return newContext;
}
