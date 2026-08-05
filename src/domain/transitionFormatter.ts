import { TransitionDefinition, WorkflowDefinition, GuardDefinition, ConditionRule } from "../types/workflow";

export interface TransitionDescription {
  headline: string;
  sourceLabel: string;
  targetLabel: string;
  eventLabel: string;
  guardSummary: string | null;
  priorityLabel: string;
  typeLabel: string;
}

export function formatConditionRule(rule: ConditionRule): string {
  const fieldName = rule.field ? rule.field.trim() : "Condition";
  const opMap: Record<string, string> = {
    equals: "equals",
    not_equals: "does not equal",
    greater_than: "is greater than",
    greater_than_or_equal: "is greater than or equal to",
    less_than: "is less than",
    less_than_or_equal: "is less than or equal to",
    contains: "contains",
    does_not_contain: "does not contain",
    exists: "exists",
    does_not_exist: "does not exist",
    starts_with: "starts with",
    ends_with: "ends with",
    matches_pattern: "matches pattern",
    is_true: "is true",
    is_false: "is false",
    is_one_of: "is one of",
  };

  const opStr = opMap[rule.operator] || rule.operator;

  if (
    rule.operator === "is_true" ||
    rule.operator === "is_false" ||
    rule.operator === "exists" ||
    rule.operator === "does_not_exist"
  ) {
    return `${fieldName} ${opStr}`;
  }

  const valStr = rule.value !== undefined && rule.value !== null ? String(rule.value) : "";
  return valStr ? `${fieldName} ${opStr} ${valStr}` : `${fieldName} ${opStr}`;
}

export function formatGuard(guard?: GuardDefinition): string | null {
  if (!guard) return null;

  if (guard.rawExpression && guard.rawExpression.trim()) {
    return guard.rawExpression.trim();
  }

  if (!guard.conditions || guard.conditions.length === 0) {
    if (guard.name && guard.name.trim()) return guard.name.trim();
    return null;
  }

  const formattedRules = guard.conditions
    .map(formatConditionRule)
    .filter((s) => s.trim().length > 0);

  if (formattedRules.length === 0) {
    return guard.name && guard.name.trim() ? guard.name.trim() : null;
  }

  if (guard.logic === "NOT") {
    if (formattedRules.length === 1) {
      return `NOT (${formattedRules[0]})`;
    }
    return `NOT (${formattedRules.join(" AND ")})`;
  }

  if (guard.logic === "ANY") {
    return formattedRules.join(" OR ");
  }

  // Default logic === "ALL"
  return formattedRules.join(" AND ");
}

export function describeTransition(
  transition: TransitionDefinition,
  workflow: WorkflowDefinition
): TransitionDescription {
  const states = workflow.states || [];
  const sourceState = states.find((s) => s.id === transition.sourceStateId);
  const targetState = states.find((s) => s.id === transition.targetStateId);

  const sourceLabel = sourceState
    ? sourceState.name
    : transition.sourceStateId
    ? `Unknown State (${transition.sourceStateId})`
    : "Unknown Source State";

  const targetLabel = targetState
    ? targetState.name
    : transition.targetStateId
    ? `Unknown State (${transition.targetStateId})`
    : "Unknown Target State";

  const eventLabel = transition.event || "NO_EVENT";
  const guardSummary = formatGuard(transition.guard);

  const priorityVal = transition.priority ?? 10;
  const priorityLabel = `Priority ${priorityVal}`;
  const typeLabel = transition.type === "internal" ? "Internal Transition" : "External Route";

  let headline = `When ${eventLabel} occurs`;
  if (guardSummary) {
    headline += ` and ${guardSummary}`;
  }
  headline += ` move from ${sourceLabel} to ${targetLabel}`;
  if (priorityVal !== undefined && priorityVal !== null) {
    headline += ` Priority ${priorityVal}`;
  }

  return {
    headline,
    sourceLabel,
    targetLabel,
    eventLabel,
    guardSummary,
    priorityLabel,
    typeLabel,
  };
}
