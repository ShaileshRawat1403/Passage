import { z } from "zod";
import { WorkflowState } from "../types/workflow";

/**
 * Passage State Machine Core Zod Schemas
 */

export const StateTypeSchema = z.enum([
  "start",
  "atomic",
  "compound",
  "decision",
  "parallel",
  "waiting",
  "approval",
  "final",
]);

export const ActionTypeSchema = z.enum([
  "agent",
  "http",
  "function",
  "notification",
  "human_task",
  "subflow",
  "transform",
  "audit",
  "wait",
  "webhook",
]);

export const ComparisonOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "does_not_contain",
  "exists",
  "does_not_exist",
  "starts_with",
  "ends_with",
  "matches_pattern",
  "is_true",
  "is_false",
  "is_one_of",
]);

export const LogicGroupSchema = z.enum(["ALL", "ANY", "NOT"]);

export const ConditionRuleSchema = z.strictObject({
  id: z.string(),
  field: z.string(), // JSONPath e.g. "$.invoice.amount" or "vendor.status"
  operator: ComparisonOperatorSchema,
  value: z.unknown().optional(),
  description: z.string().optional(),
});

export const GuardDefinitionSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  logic: LogicGroupSchema,
  conditions: z.array(ConditionRuleSchema),
  rawExpression: z.string().optional(),
});

export const RetryPolicySchema = z.strictObject({
  maxAttempts: z.number().int().min(1),
  initialDelayMs: z.number().min(0),
  backoffMultiplier: z.number().optional(),
  maxDelayMs: z.number().optional(),
  retryableErrors: z.array(z.string()).optional(),
  nonRetryableErrors: z.array(z.string()).optional(),
});

export const TimeoutPolicySchema = z.strictObject({
  durationMs: z.number().min(0),
  event: z.string(),
  targetStateId: z.string().optional(),
});

export const PermissionPolicySchema = z.strictObject({
  rolesAllowed: z.array(z.string()).optional(),
  usersAllowed: z.array(z.string()).optional(),
  overrideRequiresReason: z.boolean().optional(),
});

export const AuditPolicySchema = z.strictObject({
  enabled: z.boolean(),
  immutable: z.boolean(),
  evidenceFields: z.array(z.string()).optional(),
});

export const ParallelPolicySchema = z.strictObject({
  mode: z.enum(["all", "any", "first_success", "required_subset", "race", "best_effort"]),
  requiredActionIds: z.array(z.string()).optional(),
  cancelRemaining: z.boolean().optional(),
});

export const ActionDefinitionSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  type: ActionTypeSchema,
  description: z.string().optional(),
  executionMode: z.enum(["sequential", "parallel"]).optional(),

  connectionId: z.string().optional(),
  agentConfig: z
    .strictObject({
      agentName: z.string(),
      modelProvider: z.string(),
      model: z.string(),
      systemInstructions: z.string(),
      tools: z.array(z.string()).optional(),
      confidenceThreshold: z.number().optional(),
    })
    .optional(),

  httpConfig: z
    .strictObject({
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
      url: z.string(),
      headers: z.record(z.string(), z.string()).optional(),
      bodyTemplate: z.string().optional(),
    })
    .optional(),

  humanTaskConfig: z
    .strictObject({
      assigneeRole: z.string(),
      dueHours: z.number(),
      options: z.array(z.string()),
      requiredFields: z.array(z.string()).optional(),
    })
    .optional(),

  subflowConfig: z
    .strictObject({
      subflowWorkflowId: z.string(),
      subflowVersion: z.string().optional(),
      syncMode: z.boolean(),
    })
    .optional(),

  inputMapping: z.record(z.string(), z.string()).optional(),
  outputMapping: z.record(z.string(), z.string()).optional(),

  timeoutMs: z.number().optional(),
  retryPolicy: RetryPolicySchema.optional(),
  idempotencyKey: z.string().optional(),

  onSuccessEvent: z.string().optional(),
  onFailureEvent: z.string().optional(),
  compensationActionId: z.string().optional(),
});

export const TransitionDefinitionSchema = z.strictObject({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  sourceStateId: z.string(),
  targetStateId: z.string(),
  event: z.string(),
  guard: GuardDefinitionSchema.optional(),
  priority: z.number().optional(),
  type: z.enum(["external", "internal"]).optional(),
  permissions: z.array(z.string()).optional(),
  actions: z.array(ActionDefinitionSchema).optional(),
});

export const WorkflowStateSchema: z.ZodType<WorkflowState> = z.lazy(() =>
  z.strictObject({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    type: StateTypeSchema,

    entryActions: z.array(ActionDefinitionSchema).default([]),
    activeActions: z.array(ActionDefinitionSchema).default([]),
    exitActions: z.array(ActionDefinitionSchema).default([]),

    transitions: z.array(TransitionDefinitionSchema).default([]),

    parallelPolicy: ParallelPolicySchema.optional(),
    timeout: TimeoutPolicySchema.optional(),
    retry: RetryPolicySchema.optional(),
    permissions: PermissionPolicySchema.optional(),
    audit: AuditPolicySchema.optional(),

    position: z.strictObject({ x: z.number(), y: z.number() }).optional(),
    childStates: z.array(WorkflowStateSchema).optional(),
  })
);

export const WorkflowDefinitionSchema = z.strictObject({
  id: z.string().min(1, "Workflow ID is required"),
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  version: z.string().default("1.0.0"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),

  initialStateId: z.string().min(1, "Initial state ID is required"),
  contextSchema: z.record(z.string(), z.unknown()).optional(),
  defaultContext: z.record(z.string(), z.unknown()).optional(),

  states: z.array(WorkflowStateSchema).min(1, "At least one state is required"),

  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const WorkflowEventSchema = z.strictObject({
  id: z.string(),
  type: z.string(),
  timestamp: z.string(),
  source: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
  actorId: z.string().optional(),
  correlationId: z.string().optional(),
});

export const AuditEventSchema = z.strictObject({
  id: z.string(),
  workflowRunId: z.string(),
  workflowVersion: z.string(),
  timestamp: z.string(),
  eventType: z.enum([
    "workflow_started",
    "state_entered",
    "action_started",
    "action_completed",
    "action_failed",
    "guard_evaluated",
    "transition_taken",
    "state_exited",
    "human_approval_requested",
    "human_approval_received",
    "timeout_triggered",
    "workflow_completed",
    "workflow_failed",
  ]),
  actor: z.string().optional(),
  stateId: z.string().optional(),
  actionId: z.string().optional(),
  guardResult: z
    .strictObject({
      passed: z.boolean(),
      reason: z.string(),
    })
    .optional(),
  inputHash: z.string().optional(),
  outputHash: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const WorkflowRunSchema = z.strictObject({
  id: z.string(),
  caseId: z.string(),
  workflowId: z.string(),
  workflowVersion: z.string(),
  status: z.enum(["active", "waiting", "completed", "failed", "cancelled"]),
  currentStateId: z.string(),

  context: z.record(z.string(), z.unknown()),
  history: z.array(
    z.strictObject({
      stateId: z.string(),
      enteredAt: z.string(),
      exitedAt: z.string().optional(),
      eventTriggered: z.string().optional(),
    })
  ),

  pendingApproval: z
    .strictObject({
      assigneeRole: z.string(),
      requestedAt: z.string(),
      dueAt: z.string(),
      availableDecisions: z.array(z.string()),
    })
    .optional(),

  visitedStateIds: z.array(z.string()),
  completedActionCount: z.number(),
  failedActionCount: z.number(),
  retryCount: z.number(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  lastEventAt: z.string(),
  auditTrail: z.array(AuditEventSchema),
});
