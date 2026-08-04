import { GuardDefinition, ConditionRule, ComparisonOperator } from "../types/workflow";

/**
 * Extracts property value from context using dot notation or JSONPath (e.g. "$.invoice.amount" or "vendor.status")
 */
export function extractContextValue(context: Record<string, unknown>, pathStr: string): unknown {
  if (!pathStr) return undefined;

  let cleanPath = pathStr.trim();
  if (cleanPath.startsWith("$.")) {
    cleanPath = cleanPath.substring(2);
  } else if (cleanPath.startsWith("$")) {
    cleanPath = cleanPath.substring(1);
  }

  if (!cleanPath) return context;

  const parts = cleanPath.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Coerces unknown values to typed primitive booleans
 */
function parseBoolean(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no" || s === "") return false;
  }
  if (typeof val === "number") return val !== 0;
  return Boolean(val);
}

/**
 * Evaluates a single condition rule against the workflow context
 */
export function evaluateCondition(
  condition: ConditionRule,
  context: Record<string, unknown>
): { passed: boolean; reason: string } {
  const actualValue = extractContextValue(context, condition.field);
  const targetValue = condition.value;

  let passed = false;
  let operatorDesc = condition.operator as string;

  switch (condition.operator) {
    case "equals": {
      if (typeof actualValue === "number" || typeof targetValue === "number") {
        passed = Number(actualValue) === Number(targetValue) && !isNaN(Number(actualValue));
      } else if (typeof actualValue === "boolean" || typeof targetValue === "boolean") {
        passed = parseBoolean(actualValue) === parseBoolean(targetValue);
      } else {
        passed = String(actualValue ?? "").trim().toLowerCase() === String(targetValue ?? "").trim().toLowerCase();
      }
      operatorDesc = "equals";
      break;
    }
    case "not_equals": {
      if (typeof actualValue === "number" || typeof targetValue === "number") {
        passed = Number(actualValue) !== Number(targetValue);
      } else if (typeof actualValue === "boolean" || typeof targetValue === "boolean") {
        passed = parseBoolean(actualValue) !== parseBoolean(targetValue);
      } else {
        passed = String(actualValue ?? "").trim().toLowerCase() !== String(targetValue ?? "").trim().toLowerCase();
      }
      operatorDesc = "does not equal";
      break;
    }
    case "greater_than": {
      const actNum = Number(actualValue);
      const tgtNum = Number(targetValue);
      passed = !isNaN(actNum) && !isNaN(tgtNum) && actNum > tgtNum;
      operatorDesc = "is greater than";
      break;
    }
    case "greater_than_or_equal": {
      const actNum = Number(actualValue);
      const tgtNum = Number(targetValue);
      passed = !isNaN(actNum) && !isNaN(tgtNum) && actNum >= tgtNum;
      operatorDesc = "is greater than or equal to";
      break;
    }
    case "less_than": {
      const actNum = Number(actualValue);
      const tgtNum = Number(targetValue);
      passed = !isNaN(actNum) && !isNaN(tgtNum) && actNum < tgtNum;
      operatorDesc = "is less than";
      break;
    }
    case "less_than_or_equal": {
      const actNum = Number(actualValue);
      const tgtNum = Number(targetValue);
      passed = !isNaN(actNum) && !isNaN(tgtNum) && actNum <= tgtNum;
      operatorDesc = "is less than or equal to";
      break;
    }
    case "contains": {
      const actStr = String(actualValue ?? "").toLowerCase();
      const tgtStr = String(targetValue ?? "").toLowerCase();
      passed = actStr.includes(tgtStr);
      operatorDesc = "contains";
      break;
    }
    case "does_not_contain": {
      const actStr = String(actualValue ?? "").toLowerCase();
      const tgtStr = String(targetValue ?? "").toLowerCase();
      passed = !actStr.includes(tgtStr);
      operatorDesc = "does not contain";
      break;
    }
    case "exists": {
      passed = actualValue !== undefined && actualValue !== null && actualValue !== "";
      operatorDesc = "exists";
      break;
    }
    case "does_not_exist": {
      passed = actualValue === undefined || actualValue === null || actualValue === "";
      operatorDesc = "does not exist";
      break;
    }
    case "is_true": {
      passed = parseBoolean(actualValue) === true;
      operatorDesc = "is true";
      break;
    }
    case "is_false": {
      passed = parseBoolean(actualValue) === false;
      operatorDesc = "is false";
      break;
    }
    case "starts_with": {
      passed = String(actualValue ?? "").startsWith(String(targetValue ?? ""));
      operatorDesc = "starts with";
      break;
    }
    case "ends_with": {
      passed = String(actualValue ?? "").endsWith(String(targetValue ?? ""));
      operatorDesc = "ends with";
      break;
    }
    case "matches_pattern": {
      try {
        const pattern = new RegExp(String(targetValue ?? ""), "i");
        passed = pattern.test(String(actualValue ?? ""));
      } catch {
        passed = false;
      }
      operatorDesc = "matches regex pattern";
      break;
    }
    case "is_one_of": {
      if (Array.isArray(targetValue)) {
        passed = targetValue.includes(actualValue) || targetValue.map(String).includes(String(actualValue));
      } else if (typeof targetValue === "string") {
        const list = targetValue.split(",").map((s) => s.trim().toLowerCase());
        passed = list.includes(String(actualValue ?? "").trim().toLowerCase());
      }
      operatorDesc = "is one of";
      break;
    }
    default: {
      passed = parseBoolean(actualValue);
    }
  }

  const actualStr = actualValue === undefined ? "undefined" : JSON.stringify(actualValue);
  const targetStr = targetValue === undefined ? "" : ` ${JSON.stringify(targetValue)}`;
  const reason = passed
    ? `Field "${condition.field}" (${actualStr}) ${operatorDesc}${targetStr}`
    : `Failed: Field "${condition.field}" is ${actualStr}, expected ${operatorDesc}${targetStr}`;

  return { passed, reason };
}

/**
 * Evaluates a complete GuardDefinition against context
 */
export function evaluateGuard(
  guard: GuardDefinition | undefined,
  context: Record<string, unknown>
): { passed: boolean; reason: string; details: string[] } {
  if (!guard) {
    return { passed: true, reason: "No guard specified (unconditional transition)", details: [] };
  }

  // Advanced Expression Evaluation (Structured expression pattern matching)
  if (guard.rawExpression && guard.rawExpression.trim().length > 0) {
    const raw = guard.rawExpression.trim();
    // Parse expression like "invoice.amount > 50000" or "amount > 50000"
    const match = raw.match(/^([a-zA-Z0-9_$.]+)\s*(>|>=|<|<=|==|!=)\s*([0-9.]+|"[^"]*"|'[^']*'|true|false)$/i);
    if (match && match[1] && match[2] && match[3]) {
      const field = match[1];
      const op = match[2];
      const valStr = match[3];
      const actualVal = extractContextValue(context, field);
      let targetVal: unknown = valStr.replace(/^['"]|['"]$/g, "");
      if (typeof targetVal === "string" && !isNaN(Number(targetVal))) targetVal = Number(targetVal);
      if (targetVal === "true") targetVal = true;
      if (targetVal === "false") targetVal = false;

      const opMap: Record<string, ComparisonOperator> = {
        ">": "greater_than",
        ">=": "greater_than_or_equal",
        "<": "less_than",
        "<=": "less_than_or_equal",
        "==": "equals",
        "!=": "not_equals",
      };

      const mappedOp: ComparisonOperator = opMap[op] || "equals";

      const res = evaluateCondition(
        { id: "raw-cond", field, operator: mappedOp, value: targetVal },
        context
      );
      return {
        passed: res.passed,
        reason: res.reason,
        details: [guard.rawExpression],
      };
    } else {
      return {
        passed: false,
        reason: `Guard expression could not be parsed or evaluated: "${guard.rawExpression}"`,
        details: [guard.rawExpression],
      };
    }
  }

  if (!guard.conditions || guard.conditions.length === 0) {
    return { passed: true, reason: "Guard contains no conditions", details: [] };
  }

  const results = guard.conditions.map((cond) => evaluateCondition(cond, context));
  const details = results.map((r) => r.reason);

  if (guard.logic === "ALL") {
    const passed = results.every((r) => r.passed);
    const reason = passed
      ? `All ${results.length} conditions passed: ${details.join("; ")}`
      : `Transition blocked: ${results.filter((r) => !r.passed).map((r) => r.reason).join("; ")}`;
    return { passed, reason, details };
  } else if (guard.logic === "ANY") {
    const passed = results.some((r) => r.passed);
    const reason = passed
      ? `Matched at least one condition: ${results.filter((r) => r.passed).map((r) => r.reason).join("; ")}`
      : `Transition blocked: None of the ${results.length} conditions matched (${details.join("; ")})`;
    return { passed, reason, details };
  } else if (guard.logic === "NOT") {
    const allPassed = results.every((r) => r.passed);
    const passed = !allPassed;
    const reason = passed ? `NOT condition matched` : `Transition blocked: inner conditions matched`;
    return { passed, reason, details };
  }

  return { passed: true, reason: "Evaluated default guard logic", details };
}
