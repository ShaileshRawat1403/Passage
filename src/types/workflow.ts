/**
 * Stateflow Core Domain Types
 */

export type StateType =
  | "start"
  | "atomic"
  | "compound"
  | "decision"
  | "parallel"
  | "waiting"
  | "approval"
  | "final";

export type ActionType =
  | "agent"
  | "http"
  | "function"
  | "notification"
  | "human_task"
  | "subflow"
  | "transform"
  | "audit"
  | "wait"
  | "webhook";

export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "contains"
  | "does_not_contain"
  | "exists"
  | "does_not_exist"
  | "starts_with"
  | "ends_with"
  | "matches_pattern"
  | "is_true"
  | "is_false"
  | "is_one_of";

export type LogicGroup = "ALL" | "ANY" | "NOT";

export interface ConditionRule {
  id: string;
  field: string; // JSONPath, e.g., "$.invoice.amount" or "vendor.status"
  operator: ComparisonOperator;
  value?: unknown;
  description?: string;
}

export interface GuardDefinition {
  id: string;
  name: string;
  description?: string;
  logic: LogicGroup;
  conditions: ConditionRule[];
  rawExpression?: string; // Advanced expression override
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

export interface TimeoutPolicy {
  durationMs: number;
  event: string; // e.g. "TIMEOUT_REACHED"
  targetStateId?: string;
}

export interface PermissionPolicy {
  rolesAllowed?: string[];
  usersAllowed?: string[];
  overrideRequiresReason?: boolean;
}

export interface AuditPolicy {
  enabled: boolean;
  immutable: boolean;
  evidenceFields?: string[];
}

export interface ParallelPolicy {
  mode: "all";
  requiredActionIds?: string[];
  cancelRemaining?: boolean;
}

export interface ActionDefinition {
  id: string;
  name: string;
  type: ActionType;
  description?: string;
  executionMode?: "sequential" | "parallel";

  // Configuration per type
  connectionId?: string;
  agentConfig?: {
    agentName: string;
    modelProvider: string;
    model: string;
    systemInstructions: string;
    tools?: string[];
    confidenceThreshold?: number;
  };
  httpConfig?: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    headers?: Record<string, string>;
    bodyTemplate?: string;
  };
  humanTaskConfig?: {
    assigneeRole: string;
    dueHours: number;
    options: string[]; // e.g., ["Approve", "Reject", "Request Changes"]
    requiredFields?: string[];
  };
  subflowConfig?: {
    subflowWorkflowId: string;
    subflowVersion?: string;
    syncMode: boolean;
  };

  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;

  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  idempotencyKey?: string;

  onSuccessEvent?: string;
  onFailureEvent?: string;
  compensationActionId?: string;
}

export interface TransitionDefinition {
  id: string;
  name?: string;
  description?: string;
  sourceStateId: string;
  targetStateId: string;
  event: string;
  guard?: GuardDefinition;
  priority?: number;
  type?: "external" | "internal";
  permissions?: string[];
  actions?: ActionDefinition[];
}

export interface WorkflowState {
  id: string;
  name: string;
  description?: string;
  type: StateType;

  // Actions grouped by lifecycle phase
  entryActions: ActionDefinition[];
  activeActions: ActionDefinition[];
  exitActions: ActionDefinition[];

  transitions: TransitionDefinition[];

  // Advanced policies
  parallelPolicy?: ParallelPolicy;
  timeout?: TimeoutPolicy;
  retry?: RetryPolicy;
  permissions?: PermissionPolicy;
  audit?: AuditPolicy;

  // Positions on React Flow canvas
  position?: { x: number; y: number };
  childStates?: WorkflowState[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: "draft" | "published" | "archived";

  initialStateId: string;
  contextSchema?: Record<string, unknown>;
  defaultContext?: Record<string, unknown>;

  states: WorkflowState[];

  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  correlationId?: string;
}

export interface AuditEvent {
  id: string;
  workflowRunId: string;
  workflowVersion: string;
  timestamp: string;
  eventType:
    | "workflow_started"
    | "state_entered"
    | "action_started"
    | "action_completed"
    | "action_failed"
    | "guard_evaluated"
    | "transition_taken"
    | "state_exited"
    | "human_approval_requested"
    | "human_approval_received"
    | "timeout_triggered"
    | "workflow_completed"
    | "workflow_failed";

  actor?: string;
  stateId?: string;
  actionId?: string;
  guardResult?: {
    passed: boolean;
    reason: string;
  };
  inputHash?: string;
  outputHash?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  caseId: string;
  workflowId: string;
  workflowVersion: string;
  status: "active" | "waiting" | "completed" | "failed" | "cancelled";
  currentStateId: string;

  context: Record<string, unknown>;
  history: {
    stateId: string;
    enteredAt: string;
    exitedAt?: string;
    eventTriggered?: string;
  }[];

  pendingApproval?: {
    assigneeRole: string;
    requestedAt: string;
    dueAt: string;
    availableDecisions: string[];
  };

  visitedStateIds: string[];
  completedActionCount: number;
  failedActionCount: number;
  retryCount: number;
  startedAt: string;
  completedAt?: string;
  lastEventAt: string;
  auditTrail: AuditEvent[];
}

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
  stateId?: string;
  transitionId?: string;
  actionId?: string;
  field?: string;
}

export interface ConnectionCredential {
  id: string;
  name: string;
  type: "api_key" | "oauth2" | "basic_auth" | "agent_provider" | "webhook";
  service: string;
  status: "connected" | "disconnected" | "testing";
  lastTestedAt?: string;
}

export interface ReusableComponent {
  id: string;
  name: string;
  category: "action" | "guard_template" | "subflow";
  description: string;
  payload: ActionDefinition | GuardDefinition | WorkflowDefinition;
}
