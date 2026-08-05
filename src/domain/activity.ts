import { WorkflowDefinition, WorkflowRun, WorkspaceActivity, WorkspaceActivityCategory } from "../types/workflow";

export function createActivityEntry(
  category: WorkspaceActivityCategory,
  action: string,
  details: string,
  options?: {
    workflowId?: string;
    workflowName?: string;
    actor?: string;
    severity?: "info" | "success" | "warning" | "error";
    metadata?: Record<string, unknown>;
    timestamp?: string;
    id?: string;
  }
): WorkspaceActivity {
  return {
    id: options?.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: options?.timestamp || new Date().toISOString(),
    category,
    action,
    details,
    workflowId: options?.workflowId,
    workflowName: options?.workflowName,
    actor: options?.actor || "Workspace Operator",
    severity: options?.severity || "info",
    metadata: options?.metadata,
  };
}

/**
 * Seeds realistic chronological workspace history logs based on existing workflows and runs
 */
export function seedInitialActivityLogs(
  workflows: WorkflowDefinition[],
  runs: WorkflowRun[] = []
): WorkspaceActivity[] {
  const logs: WorkspaceActivity[] = [];
  const baseTime = Date.now();

  // 1. Initial system initialization log
  logs.push(
    createActivityEntry(
      "system",
      "Workspace Environment Initialized",
      "Passage workflow runtime initialized with deterministic state engine.",
      {
        actor: "Passage Kernel",
        severity: "info",
        timestamp: new Date(baseTime - 86400000 * 3).toISOString(), // 3 days ago
      }
    )
  );

  // 2. Sample workflows creation & import events
  workflows.forEach((wf, index) => {
    const offsetMs = (workflows.length - index) * 3600000 * 4;
    const creationTime = wf.createdAt || new Date(baseTime - offsetMs).toISOString();

    if (wf.id.includes("invoice") || wf.id.includes("vendor")) {
      logs.push(
        createActivityEntry(
          "workflow_creation",
          "Workflow Definition Created",
          `Created process definition '${wf.name}' (v${wf.version}) with ${wf.states.length} states.`,
          {
            workflowId: wf.id,
            workflowName: wf.name,
            severity: "success",
            timestamp: creationTime,
          }
        )
      );
      logs.push(
        createActivityEntry(
          "designer_edit",
          "State Structure Configured",
          `Configured ${wf.states.length} states and transitions for '${wf.name}'.`,
          {
            workflowId: wf.id,
            workflowName: wf.name,
            severity: "info",
            timestamp: new Date(new Date(creationTime).getTime() + 1800000).toISOString(),
          }
        )
      );
    } else {
      logs.push(
        createActivityEntry(
          "workflow_import",
          "Workflow Definition Imported",
          `Imported definition '${wf.name}' (v${wf.version}) into workspace.`,
          {
            workflowId: wf.id,
            workflowName: wf.name,
            severity: "info",
            timestamp: creationTime,
          }
        )
      );
    }
  });

  // 3. Runs activity logs
  runs.forEach((run) => {
    const wf = workflows.find((w) => w.id === run.workflowId);
    logs.push(
      createActivityEntry(
        "run_event",
        "Workflow Case Simulation Started",
        `Started simulation run ${run.id} on state '${run.currentStateId}'.`,
        {
          workflowId: run.workflowId,
          workflowName: wf ? wf.name : undefined,
          severity: run.status === "completed" ? "success" : run.status === "failed" ? "error" : "info",
          timestamp: run.startedAt || new Date(baseTime - 1800000).toISOString(),
        }
      )
    );
  });

  // Sort newest first
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Filter activity logs by search query, category, and workflow filter
 */
export function filterActivityLogs(
  logs: WorkspaceActivity[],
  searchQuery: string,
  categoryFilter: string,
  workflowFilter: string
): WorkspaceActivity[] {
  const query = searchQuery.trim().toLowerCase();

  return logs.filter((log) => {
    // Search query match
    if (query) {
      const matchAction = log.action.toLowerCase().includes(query);
      const matchDetails = log.details.toLowerCase().includes(query);
      const matchWfName = log.workflowName ? log.workflowName.toLowerCase().includes(query) : false;
      const matchActor = log.actor ? log.actor.toLowerCase().includes(query) : false;

      if (!matchAction && !matchDetails && !matchWfName && !matchActor) {
        return false;
      }
    }

    // Category filter match
    if (categoryFilter !== "all") {
      if (categoryFilter === "workflow_ops") {
        if (log.category !== "workflow_creation" && log.category !== "workflow_import") return false;
      } else if (categoryFilter === "designer_edits") {
        if (log.category !== "designer_edit") return false;
      } else if (categoryFilter === "run_events") {
        if (log.category !== "run_event") return false;
      } else if (categoryFilter === "connections") {
        if (log.category !== "connection") return false;
      } else if (categoryFilter !== log.category) {
        return false;
      }
    }

    // Workflow ID filter match
    if (workflowFilter !== "all") {
      if (log.workflowId !== workflowFilter) return false;
    }

    return true;
  });
}

/**
 * Format ISO timestamp into human-readable relative time and exact string
 */
export function formatActivityTimestamp(isoString: string): { relative: string; exact: string } {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return { relative: "Recently", exact: isoString };
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffMins < 1) relative = "Just now";
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = "Yesterday";
    else relative = `${diffDays}d ago`;

    const exact = date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return { relative, exact };
  } catch {
    return { relative: "Recently", exact: isoString };
  }
}
