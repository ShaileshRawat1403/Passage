import { WorkflowDefinition, WorkflowRun, WorkflowReadiness } from "../types/workflow";
import { getWorkflowReadiness } from "./readiness";
import { validateWorkflow } from "./validation";

export interface WorkspaceOverviewInput {
  workflows: WorkflowDefinition[];
  activeWorkflowId: string | null;
  activeRuns: WorkflowRun[];
}

export interface WorkflowOverviewItem {
  workflowId: string;
  name: string;
  description?: string;
  version: string;
  lifecycleStatus: WorkflowDefinition["status"];
  readiness: WorkflowReadiness;
  errorCount: number;
  warningCount: number;
  stateCount: number;
  transitionCount: number;
  updatedAt: string;
}

export interface WorkspaceAttentionItem {
  id: string;
  kind:
    | "workflow_errors"
    | "workflow_warnings"
    | "waiting_run"
    | "failed_run";
  workflowId: string;
  runId?: string;
  title: string;
  description: string;
  severity: "error" | "warning";
}

export interface WorkspaceOverview {
  continueWorkflow: WorkflowOverviewItem | null;
  recentWorkflows: WorkflowOverviewItem[];
  attentionItems: WorkspaceAttentionItem[];
  counts: {
    workflows: number;
    drafts: number;
    executable: number;
    needingAttention: number;
    activeRuns: number;
    waitingRuns: number;
  };
}

export function toOverviewItem(wf: WorkflowDefinition): WorkflowOverviewItem {
  const issues = validateWorkflow(wf);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const stateCount = wf.states ? wf.states.length : 0;
  const transitionCount = wf.states
    ? wf.states.reduce((acc, s) => acc + (s.transitions?.length || 0), 0)
    : 0;

  return {
    workflowId: wf.id,
    name: wf.name,
    description: wf.description,
    version: wf.version,
    lifecycleStatus: wf.status,
    readiness: getWorkflowReadiness(wf),
    errorCount,
    warningCount,
    stateCount,
    transitionCount,
    updatedAt: wf.updatedAt || wf.createdAt || "",
  };
}

export function sortWorkflowsRecent(workflows: WorkflowDefinition[]): WorkflowDefinition[] {
  return [...workflows].sort((a, b) => {
    const dateA = a.updatedAt || a.createdAt || "";
    const dateB = b.updatedAt || b.createdAt || "";

    const parseA = Date.parse(dateA);
    const parseB = Date.parse(dateB);

    const validA = !isNaN(parseA);
    const validB = !isNaN(parseB);

    if (validA && validB) {
      if (parseA !== parseB) {
        return parseB - parseA;
      }
    } else if (validA) {
      return -1;
    } else if (validB) {
      return 1;
    }

    return a.id.localeCompare(b.id);
  });
}

export function deriveWorkspaceOverview(
  input: WorkspaceOverviewInput
): WorkspaceOverview {
  const { workflows, activeWorkflowId, activeRuns } = input;

  // 1. Sort workflows by updatedAt descending -> ID ascending
  const sortedWorkflows = sortWorkflowsRecent(workflows);

  // 2. Derive items
  const itemsMap = new Map<string, WorkflowOverviewItem>();
  for (const wf of workflows) {
    itemsMap.set(wf.id, toOverviewItem(wf));
  }

  // 3. Continue workflow determination
  let continueWfDef: WorkflowDefinition | null = null;
  if (activeWorkflowId && workflows.some((w) => w.id === activeWorkflowId)) {
    continueWfDef = workflows.find((w) => w.id === activeWorkflowId) ?? null;
  } else if (sortedWorkflows.length > 0) {
    continueWfDef = sortedWorkflows[0] ?? null;
  }

  const continueWorkflow = continueWfDef ? itemsMap.get(continueWfDef.id) || null : null;

  // 4. Recent workflows (bounded to 5)
  const recentWorkflows = sortedWorkflows.slice(0, 5).map((wf) => itemsMap.get(wf.id)!);

  // 5. Attention items
  const attentionItems: WorkspaceAttentionItem[] = [];

  // Stable workflow sorting by ID ascending for deterministic attention ordering
  const workflowsById = [...workflows].sort((a, b) => a.id.localeCompare(b.id));

  // 5a. Workflow errors
  for (const wf of workflowsById) {
    const item = itemsMap.get(wf.id)!;
    if (item.errorCount > 0) {
      attentionItems.push({
        id: `att-wf-err-${wf.id}`,
        kind: "workflow_errors",
        workflowId: wf.id,
        title: wf.name,
        description: `${item.errorCount} validation ${
          item.errorCount === 1 ? "error prevents" : "errors prevent"
        } execution.`,
        severity: "error",
      });
    }
  }

  // 5b. Failed runs
  const sortedRuns = [...activeRuns].sort((a, b) => a.id.localeCompare(b.id));
  for (const run of sortedRuns) {
    if (run.status === "failed") {
      const hasActionError = run.failedActionCount && run.failedActionCount > 0;
      attentionItems.push({
        id: `att-run-fail-${run.id}`,
        kind: "failed_run",
        workflowId: run.workflowId,
        runId: run.id,
        title: `Case ${run.id}`,
        description: hasActionError
          ? `Execution failed due to action execution error.`
          : `Execution is in a failed state.`,
        severity: "error",
      });
    }
  }

  // 5c. Waiting runs
  for (const run of sortedRuns) {
    if (run.status === "waiting") {
      const isPendingApproval = Boolean(run.pendingApproval);
      attentionItems.push({
        id: `att-run-wait-${run.id}`,
        kind: "waiting_run",
        workflowId: run.workflowId,
        runId: run.id,
        title: `Case ${run.id}`,
        description: isPendingApproval
          ? `Waiting for human approval.`
          : `Execution is waiting for input.`,
        severity: "warning",
      });
    }
  }

  // 5d. Workflow warnings (when no errors)
  for (const wf of workflowsById) {
    const item = itemsMap.get(wf.id)!;
    if (item.errorCount === 0 && item.warningCount > 0) {
      attentionItems.push({
        id: `att-wf-warn-${wf.id}`,
        kind: "workflow_warnings",
        workflowId: wf.id,
        title: wf.name,
        description: `${item.warningCount} ${
          item.warningCount === 1 ? "warning should" : "warnings should"
        } be reviewed.`,
        severity: "warning",
      });
    }
  }

  // 6. Counts
  const draftsCount = workflows.filter((w) => w.status === "draft").length;
  const executableCount = workflows.filter(
    (w) => itemsMap.get(w.id)?.readiness === "executable"
  ).length;
  const activeRunsCount = activeRuns.filter((r) => r.status === "active").length;
  const waitingRunsCount = activeRuns.filter((r) => r.status === "waiting").length;

  return {
    continueWorkflow,
    recentWorkflows,
    attentionItems,
    counts: {
      workflows: workflows.length,
      drafts: draftsCount,
      executable: executableCount,
      needingAttention: attentionItems.length,
      activeRuns: activeRunsCount,
      waitingRuns: waitingRunsCount,
    },
  };
}
