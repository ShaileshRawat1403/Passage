import { createHash } from "crypto";
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

function computeHash(payload: unknown): string {
  if (!payload) return "";
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(str).digest("hex");
}

export class CommandService {
  private adapter = getPersistenceAdapter();

  async saveWorkflow(
    definition: WorkflowDefinition,
    idempotencyKey?: string
  ): Promise<CommandResponse<WorkflowDefinition>> {
    const requestHash = computeHash(definition);

    if (idempotencyKey) {
      try {
        const check = await this.adapter.checkOrSetIdempotency(idempotencyKey, requestHash);
        if (check.isDuplicate) {
          if (check.inProgress) {
            return {
              success: false,
              error: `Command with idempotency key '${idempotencyKey}' is currently in progress.`,
              isDuplicate: true,
            };
          }
          if (check.record?.response) {
            return {
              success: true,
              data: check.record.response as unknown as WorkflowDefinition,
              isDuplicate: true,
            };
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    try {
      const val = WorkflowDefinitionSchema.safeParse(definition);
      if (!val.success) {
        const errMsg = `Workflow validation failed: ${val.error.issues.map((i) => i.message).join(", ")}`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
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
        await this.adapter.completeIdempotency(
          idempotencyKey,
          savedHead as unknown as Record<string, unknown>
        );
      }

      return { success: true, data: savedHead };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, msg);
      return { success: false, error: msg };
    }
  }

  async publishWorkflowVersion(
    workflowId: string,
    version: string,
    idempotencyKey?: string
  ): Promise<CommandResponse<WorkflowDefinition>> {
    const requestHash = computeHash({ workflowId, version });

    if (idempotencyKey) {
      try {
        const check = await this.adapter.checkOrSetIdempotency(idempotencyKey, requestHash);
        if (check.isDuplicate) {
          if (check.inProgress) {
            return {
              success: false,
              error: `Command with idempotency key '${idempotencyKey}' is currently in progress.`,
              isDuplicate: true,
            };
          }
          if (check.record?.response) {
            return {
              success: true,
              data: check.record.response as unknown as WorkflowDefinition,
              isDuplicate: true,
            };
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    try {
      const head = await this.adapter.getWorkflowHead(workflowId);
      if (!head) {
        const errMsg = `Workflow ${workflowId} version ${workflowVersion} not found`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
      }
      
      const computedHash = computeHash(wf);
      if (computedHash !== workflowVersionHash) {
        const errMsg = `Mismatched content hash for workflow ${workflowId} version ${workflowVersion}`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
      }

      const updatedHead: WorkflowDefinition = {
        ...head,
        version,
        status: "published",
        updatedAt: new Date().toISOString(),
      };

      const activity: WorkspaceActivity = {
        id: `act-wf-pub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        category: "designer_edit",
        action: "Workflow Version Published",
        workflowId: updatedHead.id,
        workflowName: updatedHead.name,
        details: `Published immutable workflow version ${version} for ${updatedHead.name}.`,
        severity: "success",
        isDemo: false,
      };

      const savedHead = await this.adapter.publishWorkflowVersionAtomic({
        contentHash: computeHash(updatedHead),
        workflowId,
        version,
        definition: updatedHead,
        activity,
        idempotencyKey,
        idempotencyResponse: updatedHead as unknown as Record<string, unknown>,
      });

      return { success: true, data: savedHead };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, msg);
      return { success: false, error: msg };
    }
  }

  async createRun(
    workflowId: string,
    workflowVersion: string,
    workflowVersionHash: string,
    caseId?: string,
    initialContext?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<CommandResponse<WorkflowRun>> {
    const requestHash = computeHash({ workflowId, workflowVersion, workflowVersionHash, caseId, initialContext });

    if (idempotencyKey) {
      try {
        const check = await this.adapter.checkOrSetIdempotency(idempotencyKey, requestHash);
        if (check.isDuplicate) {
          if (check.inProgress) {
            return {
              success: false,
              error: `Command with idempotency key '${idempotencyKey}' is currently in progress.`,
              isDuplicate: true,
            };
          }
          if (check.record?.response) {
            return {
              success: true,
              data: check.record.response as unknown as WorkflowRun,
              isDuplicate: true,
            };
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    try {
      const wf = await this.adapter.getWorkflowVersion(workflowId, workflowVersion);
      if (!wf) {
        const errMsg = `Workflow ${workflowId} version ${workflowVersion} not found`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
      }

      const actualCaseId = caseId || `CASE-${Date.now().toString(36).toUpperCase()}`;
      const computedHash = computeHash(wf);
      if (computedHash !== workflowVersionHash) {
        const errMsg = `Mismatched content hash for workflow ${workflowId} version ${workflowVersion}`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
      }
      const newRun = createWorkflowRun(wf, initialContext, actualCaseId);
      newRun.workflowVersionHash = workflowVersionHash;
      newRun.workspaceId = wf.workspaceId || "default-workspace";

      const sequencedEvents = newRun.auditTrail.map((ev, i) => ({
        ...ev,
        sequence: i + 1,
      }));

      const activity: WorkspaceActivity = {
        id: `act-run-create-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        category: "run_event",
        action: "Workflow Run Started",
        workflowId: wf.id,
        workflowName: wf.name,
        details: `Started run ${newRun.id} (Case: ${newRun.caseId}) on initial state '${newRun.currentStateId}'.`,
        severity: "info",
        isDemo: false,
      };

      const runWithSequencedAudit: WorkflowRun = {
        ...newRun,
        auditTrail: sequencedEvents,
      };

      const savedRun = await this.adapter.saveRunAndEventsBatch({
        run: runWithSequencedAudit,
        newEvents: sequencedEvents,
        activity,
        idempotencyKey,
        idempotencyResponse: runWithSequencedAudit as unknown as Record<string, unknown>,
      });

      return { success: true, data: savedRun };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, msg);
      return { success: false, error: msg };
    }
  }

  async dispatchRunEvent(
    runId: string,
    eventName: string,
    eventPayload?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<CommandResponse<{ updatedRun: WorkflowRun; transitionTaken: boolean }>> {
    const requestHash = computeHash({ runId, eventName, eventPayload });

    if (idempotencyKey) {
      try {
        const check = await this.adapter.checkOrSetIdempotency(idempotencyKey, requestHash);
        if (check.isDuplicate) {
          if (check.inProgress) {
            return {
              success: false,
              error: `Command with idempotency key '${idempotencyKey}' is currently in progress.`,
              isDuplicate: true,
            };
          }
          if (check.record?.response) {
            return {
              success: true,
              data: check.record.response as unknown as {
                updatedRun: WorkflowRun;
                transitionTaken: boolean;
              },
              isDuplicate: true,
            };
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    try {
      const run = await this.adapter.getWorkflowRun(runId);
      if (!run) {
        const errMsg = `Run ${runId} not found`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
      }

      const wf = await this.adapter.getWorkflowVersion(run.workflowId, run.workflowVersion);
      if (!wf) {
        const errMsg = `Workflow definition for ${run.workflowId} version ${run.workflowVersion} not found`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
      }

      const currentRev = run.revision || 1;
      const prevAuditCount = run.auditTrail.length;

      const result = dispatchWorkflowEvent(wf, run, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: eventName,
        timestamp: new Date().toISOString(),
        source: "client_dispatch",
        payload: eventPayload,
      });

      const newEventsRaw = result.updatedRun.auditTrail.slice(prevAuditCount);
      const newEventsSequenced = newEventsRaw.map((ev, i) => ({
        ...ev,
        sequence: prevAuditCount + i + 1,
      }));

      const fullAuditTrail = [
        ...run.auditTrail,
        ...newEventsSequenced,
      ];

      const transitionTaken = Boolean(result.transitionTaken);

      const activity: WorkspaceActivity = {
        id: `act-dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        category: "run_event",
        action: transitionTaken ? "Transition Taken" : "Event Dispatched",
        workflowId: wf.id,
        workflowName: wf.name,
        details: transitionTaken
          ? `Run ${runId} transitioned from '${run.currentStateId}' to '${result.updatedRun.currentStateId}' via event '${eventName}'.`
          : `Event '${eventName}' processed for run ${runId} (no state transition).`,
        severity: transitionTaken ? "success" : "info",
        isDemo: false,
      };

      const finalUpdatedRun: WorkflowRun = {
        ...result.updatedRun,
        revision: currentRev + 1,
        auditTrail: fullAuditTrail,
      };

      const responsePayload = { updatedRun: finalUpdatedRun, transitionTaken };

      const savedRun = await this.adapter.saveRunAndEventsBatch({
        run: finalUpdatedRun,
        newEvents: newEventsSequenced,
        activity,
        idempotencyKey,
        idempotencyResponse: responsePayload as unknown as Record<string, unknown>,
        expectedRevision: currentRev,
      });

      return {
        success: true,
        data: { updatedRun: savedRun, transitionTaken },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, msg);
      return { success: false, error: msg };
    }
  }

  async saveConnection(
    connection: ConnectionCredential,
    idempotencyKey?: string
  ): Promise<CommandResponse<ConnectionCredential>> {
    const requestHash = computeHash(connection);

    if (idempotencyKey) {
      try {
        const check = await this.adapter.checkOrSetIdempotency(idempotencyKey, requestHash);
        if (check.isDuplicate) {
          if (check.inProgress) {
            return {
              success: false,
              error: `Command with idempotency key '${idempotencyKey}' is currently in progress.`,
              isDuplicate: true,
            };
          }
          if (check.record?.response) {
            return {
              success: true,
              data: check.record.response as unknown as ConnectionCredential,
              isDuplicate: true,
            };
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    try {
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
        await this.adapter.completeIdempotency(
          idempotencyKey,
          saved as unknown as Record<string, unknown>
        );
      }

      return { success: true, data: saved };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, msg);
      return { success: false, error: msg };
    }
  }
}

export const commandService = new CommandService();
