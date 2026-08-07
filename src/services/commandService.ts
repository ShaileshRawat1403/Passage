import { getPersistenceAdapter } from "./persistenceAdapter";
import {
  WorkflowDefinition,
  WorkflowRun,
  AuditEvent,
  WorkspaceActivity,
  ConnectionCredential,
} from "../types/workflow";
import { WorkflowDefinitionSchema } from "../domain/schemas";
import { dispatchWorkflowEvent, createWorkflowRun } from "../domain/runtime";

export interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  isDuplicate?: boolean;
}

export class CommandService {
  private adapter = getPersistenceAdapter();

  async saveWorkflow(
    definition: WorkflowDefinition,
    idempotencyKey?: string
  ): Promise<CommandResponse<WorkflowDefinition>> {
    if (idempotencyKey) {
      const check = await this.adapter.checkOrSetIdempotency(idempotencyKey);
      if (check.isDuplicate && check.record?.response) {
        return {
          success: true,
          data: check.record.response as unknown as WorkflowDefinition,
          isDuplicate: true,
        };
      }
    }

    const val = WorkflowDefinitionSchema.safeParse(definition);
    if (!val.success) {
      return {
        success: false,
        error: `Workflow validation failed: ${val.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const savedHead = await this.adapter.saveWorkflowHead(val.data as WorkflowDefinition);

    const activity: WorkspaceActivity = {
      id: `act-wf-save-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      category: "designer_edit",
      action: "Workflow Definition Saved",
      workflowId: savedHead.id,
      workflowName: savedHead.name,
      details: `Saved workflow head ${savedHead.name} (v${savedHead.version}) with ${savedHead.states.length} states.`,
      severity: "info",
      isDemo: false,
    };
    await this.adapter.appendWorkspaceActivity(activity);

    if (idempotencyKey) {
      await this.adapter.completeIdempotency(idempotencyKey, savedHead as unknown as Record<string, unknown>);
    }

    return { success: true, data: savedHead };
  }

  async publishWorkflowVersion(
    workflowId: string,
    version: string,
    idempotencyKey?: string
  ): Promise<CommandResponse<WorkflowDefinition>> {
    if (idempotencyKey) {
      const check = await this.adapter.checkOrSetIdempotency(idempotencyKey);
      if (check.isDuplicate && check.record?.response) {
        return {
          success: true,
          data: check.record.response as unknown as WorkflowDefinition,
          isDuplicate: true,
        };
      }
    }

    const head = await this.adapter.getWorkflowHead(workflowId);
    if (!head) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    const updatedHead: WorkflowDefinition = {
      ...head,
      version,
      status: "published",
      updatedAt: new Date().toISOString(),
    };

    await this.adapter.saveWorkflowVersion(workflowId, version, updatedHead);
    const savedHead = await this.adapter.saveWorkflowHead(updatedHead);

    const activity: WorkspaceActivity = {
      id: `act-wf-pub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      category: "designer_edit",
      action: "Workflow Version Published",
      workflowId: savedHead.id,
      workflowName: savedHead.name,
      details: `Published immutable workflow version ${version} for ${savedHead.name}.`,
      severity: "success",
      isDemo: false,
    };
    await this.adapter.appendWorkspaceActivity(activity);

    if (idempotencyKey) {
      await this.adapter.completeIdempotency(idempotencyKey, savedHead as unknown as Record<string, unknown>);
    }

    return { success: true, data: savedHead };
  }

  async createRun(
    workflowId: string,
    caseId?: string,
    initialContext?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<CommandResponse<WorkflowRun>> {
    if (idempotencyKey) {
      const check = await this.adapter.checkOrSetIdempotency(idempotencyKey);
      if (check.isDuplicate && check.record?.response) {
        return {
          success: true,
          data: check.record.response as unknown as WorkflowRun,
          isDuplicate: true,
        };
      }
    }

    const wf = await this.adapter.getWorkflowHead(workflowId);
    if (!wf) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    const runId = `RUN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const actualCaseId = caseId || `CASE-${Date.now().toString(36).toUpperCase()}`;

    const newRun = createWorkflowRun(wf, initialContext, actualCaseId);

    // Save run to storage
    const savedRun = await this.adapter.saveWorkflowRun(newRun);

    // Append append-only run events
    for (const event of savedRun.auditTrail) {
      await this.adapter.appendRunEvent(event);
    }

    // Append workspace activity
    const activity: WorkspaceActivity = {
      id: `act-run-create-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      category: "run_event",
      action: "Workflow Run Started",
      workflowId: wf.id,
      workflowName: wf.name,
      details: `Started run ${savedRun.id} (Case: ${savedRun.caseId}) on initial state '${savedRun.currentStateId}'.`,
      severity: "info",
      isDemo: false,
    };
    await this.adapter.appendWorkspaceActivity(activity);

    if (idempotencyKey) {
      await this.adapter.completeIdempotency(idempotencyKey, savedRun as unknown as Record<string, unknown>);
    }

    return { success: true, data: savedRun };
  }

  async dispatchRunEvent(
    runId: string,
    eventName: string,
    eventPayload?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<CommandResponse<{ updatedRun: WorkflowRun; transitionTaken: boolean }>> {
    if (idempotencyKey) {
      const check = await this.adapter.checkOrSetIdempotency(idempotencyKey);
      if (check.isDuplicate && check.record?.response) {
        return {
          success: true,
          data: check.record.response as unknown as { updatedRun: WorkflowRun; transitionTaken: boolean },
          isDuplicate: true,
        };
      }
    }

    const run = await this.adapter.getWorkflowRun(runId);
    if (!run) {
      return { success: false, error: `Run ${runId} not found` };
    }

    const wf = await this.adapter.getWorkflowHead(run.workflowId);
    if (!wf) {
      return { success: false, error: `Workflow definition for ${run.workflowId} not found` };
    }

    const prevAuditCount = run.auditTrail.length;

    const result = dispatchWorkflowEvent(wf, run, {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: eventName,
      timestamp: new Date().toISOString(),
      source: "client_dispatch",
      payload: eventPayload,
    });

    const updatedRun = await this.adapter.saveWorkflowRun(result.updatedRun);

    // Persist new audit/run events append-only
    const newEvents = updatedRun.auditTrail.slice(prevAuditCount);
    for (const ev of newEvents) {
      await this.adapter.appendRunEvent(ev);
    }

    const transitionTaken = Boolean(result.transitionTaken);

    // Log activity
    const activity: WorkspaceActivity = {
      id: `act-dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      category: "run_event",
      action: transitionTaken ? "Transition Taken" : "Event Dispatched",
      workflowId: wf.id,
      workflowName: wf.name,
      details: transitionTaken
        ? `Run ${runId} transitioned from '${run.currentStateId}' to '${updatedRun.currentStateId}' via event '${eventName}'.`
        : `Event '${eventName}' processed for run ${runId} (no state transition).`,
      severity: transitionTaken ? "success" : "info",
      isDemo: false,
    };
    await this.adapter.appendWorkspaceActivity(activity);

    const responsePayload = { updatedRun, transitionTaken };

    if (idempotencyKey) {
      await this.adapter.completeIdempotency(idempotencyKey, responsePayload as unknown as Record<string, unknown>);
    }

    return { success: true, data: responsePayload };
  }

  async saveConnection(
    connection: ConnectionCredential,
    idempotencyKey?: string
  ): Promise<CommandResponse<ConnectionCredential>> {
    if (idempotencyKey) {
      const check = await this.adapter.checkOrSetIdempotency(idempotencyKey);
      if (check.isDuplicate && check.record?.response) {
        return {
          success: true,
          data: check.record.response as unknown as ConnectionCredential,
          isDuplicate: true,
        };
      }
    }

    // Status model correction: ordinary provider templates default to "configured" or "untested"
    let status = connection.status;
    if (status === "available_local" && !connection.id.includes("ollama")) {
      status = "configured";
    }

    const sanitizedConn: ConnectionCredential = {
      ...connection,
      status,
    };

    const saved = await this.adapter.saveConnection(sanitizedConn);

    const activity: WorkspaceActivity = {
      id: `act-conn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      category: "connection",
      action: "Provider Connection Template Configured",
      details: `Configured template '${saved.name}' (${saved.service}).`,
      severity: "info",
      isDemo: false,
    };
    await this.adapter.appendWorkspaceActivity(activity);

    if (idempotencyKey) {
      await this.adapter.completeIdempotency(idempotencyKey, saved as unknown as Record<string, unknown>);
    }

    return { success: true, data: saved };
  }
}

export const commandService = new CommandService();
