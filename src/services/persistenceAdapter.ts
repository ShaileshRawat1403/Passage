import { initializeApp as initAdminApp, getApps as getAdminApps, App as AdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from "firebase-admin/firestore";
import {
  WorkflowDefinition,
  WorkflowRun,
  AuditEvent,
  WorkspaceActivity,
  ConnectionCredential,
} from "../types/workflow";
import {
  WorkflowEntity,
  WorkflowEntitySchema,
  WorkflowVersionEntity,
  WorkflowVersionEntitySchema,
  IdempotencyRecord,
  IdempotencyRecordSchema,
  RunEventEntitySchema,
  WorkspaceActivityEntitySchema,
  ConnectionEntitySchema,
} from "../domain/persistence";
import { WorkflowRunSchema } from "../domain/schemas";

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  inProgress?: boolean;
  record?: IdempotencyRecord;
}

export interface SaveRunBatchOptions {
  run: WorkflowRun;
  newEvents: AuditEvent[];
  activity?: WorkspaceActivity;
  idempotencyKey?: string;
  idempotencyResponse?: Record<string, unknown>;
}

export interface IPersistenceAdapter {
  saveWorkflowHead(workflow: WorkflowDefinition): Promise<WorkflowDefinition>;
  getWorkflowHead(workflowId: string): Promise<WorkflowDefinition | null>;
  getAllWorkflows(): Promise<WorkflowDefinition[]>;
  deleteWorkflow(workflowId: string): Promise<void>;

  saveWorkflowVersion(
    workflowId: string,
    version: string,
    definition: WorkflowDefinition
  ): Promise<WorkflowVersionEntity>;
  getWorkflowVersion(
    workflowId: string,
    version: string
  ): Promise<WorkflowDefinition | null>;

  saveWorkflowRun(run: WorkflowRun): Promise<WorkflowRun>;
  getWorkflowRun(runId: string): Promise<WorkflowRun | null>;
  getAllWorkflowRuns(): Promise<WorkflowRun[]>;

  appendRunEvent(event: AuditEvent): Promise<AuditEvent>;
  getRunEvents(runId: string): Promise<AuditEvent[]>;

  saveRunAndEventsBatch(options: SaveRunBatchOptions): Promise<WorkflowRun>;

  appendWorkspaceActivity(activity: WorkspaceActivity): Promise<WorkspaceActivity>;
  getWorkspaceActivities(): Promise<WorkspaceActivity[]>;

  saveConnection(connection: ConnectionCredential): Promise<ConnectionCredential>;
  getAllConnections(): Promise<ConnectionCredential[]>;
  deleteConnection(connectionId: string): Promise<void>;

  checkOrSetIdempotency(
    key: string,
    requestHash?: string
  ): Promise<IdempotencyCheckResult>;
  completeIdempotency(
    key: string,
    response?: Record<string, unknown>
  ): Promise<void>;
  failIdempotency(
    key: string,
    errorReason: string
  ): Promise<void>;
}

/**
 * In-Memory Storage Adapter for unit testing and local development
 */
export class MemoryPersistenceAdapter implements IPersistenceAdapter {
  private workflows = new Map<string, WorkflowEntity>();
  private versions = new Map<string, WorkflowVersionEntity>();
  private runs = new Map<string, WorkflowRun>();
  private runEvents: AuditEvent[] = [];
  private activities: WorkspaceActivity[] = [];
  private connections = new Map<string, ConnectionCredential>();
  private idempotencyRecords = new Map<string, IdempotencyRecord>();

  async saveWorkflowHead(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const now = new Date().toISOString();
    const existing = this.workflows.get(workflow.id);
    const entity: WorkflowEntity = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || "",
      currentVersion: workflow.version || "1.0.0",
      status: workflow.status || "draft",
      headDefinition: workflow,
      createdAt: existing?.createdAt || workflow.createdAt || now,
      updatedAt: now,
    };
    const validated = WorkflowEntitySchema.parse(entity);
    this.workflows.set(workflow.id, validated);
    return validated.headDefinition;
  }

  async getWorkflowHead(workflowId: string): Promise<WorkflowDefinition | null> {
    const entity = this.workflows.get(workflowId);
    if (!entity) return null;
    const validated = WorkflowEntitySchema.parse(entity);
    return validated.headDefinition;
  }

  async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    return Array.from(this.workflows.values()).map((e) => {
      const validated = WorkflowEntitySchema.parse(e);
      return validated.headDefinition;
    });
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    this.workflows.delete(workflowId);
  }

  async saveWorkflowVersion(
    workflowId: string,
    version: string,
    definition: WorkflowDefinition
  ): Promise<WorkflowVersionEntity> {
    const versionKey = `${workflowId}_v${version}`;
    if (this.versions.has(versionKey)) {
      throw new Error(
        `Version ${version} for workflow ${workflowId} already exists and is immutable.`
      );
    }
    const versionEntity: WorkflowVersionEntity = {
      id: versionKey,
      workflowId,
      version,
      definition,
      createdAt: new Date().toISOString(),
    };
    const validated = WorkflowVersionEntitySchema.parse(versionEntity);
    this.versions.set(versionKey, validated);
    return validated;
  }

  async getWorkflowVersion(
    workflowId: string,
    version: string
  ): Promise<WorkflowDefinition | null> {
    const entity = this.versions.get(`${workflowId}_v${version}`);
    if (!entity) return null;
    const validated = WorkflowVersionEntitySchema.parse(entity);
    return validated.definition;
  }

  async saveWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
    const validated = WorkflowRunSchema.parse({
      ...run,
      lastEventAt: run.lastEventAt || new Date().toISOString(),
    });
    this.runs.set(run.id, validated);
    return validated;
  }

  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    const run = this.runs.get(runId);
    if (!run) return null;
    return WorkflowRunSchema.parse(run);
  }

  async getAllWorkflowRuns(): Promise<WorkflowRun[]> {
    return Array.from(this.runs.values()).map((r) => WorkflowRunSchema.parse(r));
  }

  async appendRunEvent(event: AuditEvent): Promise<AuditEvent> {
    const existingEv = this.runEvents.find((e) => e.id === event.id);
    if (existingEv) {
      throw new Error(
        `Run event with ID '${event.id}' already exists and cannot be overwritten (append-only violation).`
      );
    }
    const run = this.runs.get(event.workflowRunId);
    const existingRunEvents = this.runEvents.filter(
      (e) => e.workflowRunId === event.workflowRunId
    );
    const sequence = event.sequence || existingRunEvents.length + 1;
    const sequencedEvent: AuditEvent = { ...event, sequence };
    const validated = RunEventEntitySchema.parse(sequencedEvent);

    this.runEvents.push(validated);

    if (run) {
      const exists = run.auditTrail.some((e) => e.id === validated.id);
      if (!exists) {
        run.auditTrail.push(validated);
      }
      run.lastEventAt = validated.timestamp || new Date().toISOString();
      this.runs.set(run.id, WorkflowRunSchema.parse(run));
    }
    return validated;
  }

  async getRunEvents(runId: string): Promise<AuditEvent[]> {
    const events = this.runEvents.filter((e) => e.workflowRunId === runId);
    return events.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }

  async saveRunAndEventsBatch(options: SaveRunBatchOptions): Promise<WorkflowRun> {
    const validatedRun = WorkflowRunSchema.parse({
      ...options.run,
      lastEventAt: options.run.lastEventAt || new Date().toISOString(),
    });

    for (const ev of options.newEvents) {
      const exists = this.runEvents.some((e) => e.id === ev.id);
      if (exists) {
        throw new Error(
          `Run event with ID '${ev.id}' already exists and cannot be overwritten (append-only violation).`
        );
      }
      const validatedEv = RunEventEntitySchema.parse(ev);
      this.runEvents.push(validatedEv);
    }

    this.runs.set(validatedRun.id, validatedRun);

    if (options.activity) {
      const existsAct = this.activities.some((a) => a.id === options.activity!.id);
      if (existsAct) {
        throw new Error(
          `Workspace activity with ID '${options.activity.id}' already exists and cannot be overwritten (append-only violation).`
        );
      }
      const validatedAct = WorkspaceActivityEntitySchema.parse(options.activity);
      this.activities.unshift(validatedAct);
    }

    if (options.idempotencyKey) {
      await this.completeIdempotency(options.idempotencyKey, options.idempotencyResponse);
    }

    return validatedRun;
  }

  async appendWorkspaceActivity(activity: WorkspaceActivity): Promise<WorkspaceActivity> {
    const validated = WorkspaceActivityEntitySchema.parse(activity);
    const existingIdx = this.activities.findIndex((a) => a.id === validated.id);
    if (existingIdx >= 0) {
      throw new Error(
        `Workspace activity with ID '${validated.id}' already exists and cannot be overwritten (append-only violation).`
      );
    }
    this.activities.unshift(validated);
    return validated;
  }

  async getWorkspaceActivities(): Promise<WorkspaceActivity[]> {
    return [...this.activities]
      .map((a) => WorkspaceActivityEntitySchema.parse(a))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async saveConnection(connection: ConnectionCredential): Promise<ConnectionCredential> {
    const validated = ConnectionEntitySchema.parse(connection);
    this.connections.set(validated.id, validated);
    return validated;
  }

  async getAllConnections(): Promise<ConnectionCredential[]> {
    return Array.from(this.connections.values()).map((c) => ConnectionEntitySchema.parse(c));
  }

  async deleteConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async checkOrSetIdempotency(
    key: string,
    requestHash?: string
  ): Promise<IdempotencyCheckResult> {
    const existing = this.idempotencyRecords.get(key);
    if (existing) {
      if (existing.status === "completed") {
        if (
          requestHash &&
          existing.requestHash &&
          existing.requestHash !== requestHash
        ) {
          throw new Error(
            `Idempotency key conflict: key '${key}' was already used with a different request payload.`
          );
        }
        return { isDuplicate: true, inProgress: false, record: existing };
      }

      const isStale =
        existing.status === "pending" &&
        Date.now() - new Date(existing.createdAt).getTime() > 30000;

      if (existing.status === "failed" || isStale) {
        const resetRecord: IdempotencyRecord = {
          ...existing,
          requestHash,
          status: "pending",
          createdAt: new Date().toISOString(),
          response: undefined,
          completedAt: undefined,
        };
        const validated = IdempotencyRecordSchema.parse(resetRecord);
        this.idempotencyRecords.set(key, validated);
        return { isDuplicate: false, inProgress: false, record: validated };
      }

      return { isDuplicate: true, inProgress: true, record: existing };
    }

    const newRecord: IdempotencyRecord = {
      id: `idemp-${key}`,
      key,
      requestHash,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const validated = IdempotencyRecordSchema.parse(newRecord);
    this.idempotencyRecords.set(key, validated);
    return { isDuplicate: false, inProgress: false, record: validated };
  }

  async completeIdempotency(
    key: string,
    response?: Record<string, unknown>
  ): Promise<void> {
    const existing = this.idempotencyRecords.get(key);
    if (existing) {
      existing.status = "completed";
      existing.response = response;
      existing.completedAt = new Date().toISOString();
      this.idempotencyRecords.set(key, IdempotencyRecordSchema.parse(existing));
    }
  }

  async failIdempotency(key: string, errorReason: string): Promise<void> {
    const existing = this.idempotencyRecords.get(key);
    if (existing) {
      existing.status = "failed";
      existing.response = { error: errorReason };
      existing.completedAt = new Date().toISOString();
      this.idempotencyRecords.set(key, IdempotencyRecordSchema.parse(existing));
    }
  }

  clearAll(): void {
    this.workflows.clear();
    this.versions.clear();
    this.runs.clear();
    this.runEvents = [];
    this.activities = [];
    this.connections.clear();
    this.idempotencyRecords.clear();
  }
}

/**
 * Server-Side Admin Firestore Persistence Adapter
 * Uses firebase-admin to bypass client rules securely from Passage backend endpoints.
 */
export class FirestorePersistenceAdapter implements IPersistenceAdapter {
  private db: AdminFirestore;

  constructor(projectId?: string) {
    const existingApps = getAdminApps();
    let app: AdminApp;
    if (existingApps.length > 0) {
      app = existingApps[0]!;
    } else {
      const pId = projectId || process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT;
      if (!pId) {
        throw new Error(
          "Firestore Persistence Initialization Failed: Missing Project ID for firebase-admin."
        );
      }
      app = initAdminApp({ projectId: pId });
    }
    this.db = getAdminFirestore(app);
  }

  async saveWorkflowHead(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const docRef = this.db.collection("workflows").doc(workflow.id);
    const snap = await docRef.get();
    const existing = snap.exists ? (snap.data() as WorkflowEntity) : null;
    const now = new Date().toISOString();

    const entity: WorkflowEntity = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || "",
      currentVersion: workflow.version || "1.0.0",
      status: workflow.status || "draft",
      headDefinition: workflow,
      createdAt: existing?.createdAt || workflow.createdAt || now,
      updatedAt: now,
    };
    const validated = WorkflowEntitySchema.parse(entity);
    await docRef.set(validated);
    return validated.headDefinition;
  }

  async getWorkflowHead(workflowId: string): Promise<WorkflowDefinition | null> {
    const docRef = this.db.collection("workflows").doc(workflowId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const validated = WorkflowEntitySchema.parse(snap.data());
    return validated.headDefinition;
  }

  async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    const snap = await this.db.collection("workflows").get();
    return snap.docs.map((d) => {
      const validated = WorkflowEntitySchema.parse(d.data());
      return validated.headDefinition;
    });
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.db.collection("workflows").doc(workflowId).delete();
  }

  async saveWorkflowVersion(
    workflowId: string,
    version: string,
    definition: WorkflowDefinition
  ): Promise<WorkflowVersionEntity> {
    const versionKey = `${workflowId}_v${version}`;
    const docRef = this.db.collection("workflow_versions").doc(versionKey);

    return await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists) {
        throw new Error(
          `Version ${version} for workflow ${workflowId} already exists and is immutable.`
        );
      }
      const versionEntity: WorkflowVersionEntity = {
        id: versionKey,
        workflowId,
        version,
        definition,
        createdAt: new Date().toISOString(),
      };
      const validated = WorkflowVersionEntitySchema.parse(versionEntity);
      transaction.set(docRef, validated);
      return validated;
    });
  }

  async getWorkflowVersion(
    workflowId: string,
    version: string
  ): Promise<WorkflowDefinition | null> {
    const versionKey = `${workflowId}_v${version}`;
    const snap = await this.db.collection("workflow_versions").doc(versionKey).get();
    if (!snap.exists) return null;
    const validated = WorkflowVersionEntitySchema.parse(snap.data());
    return validated.definition;
  }

  async saveWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
    const validated = WorkflowRunSchema.parse({
      ...run,
      lastEventAt: run.lastEventAt || new Date().toISOString(),
    });
    await this.db.collection("workflow_runs").doc(run.id).set(validated, { merge: true });
    return validated;
  }

  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    const snap = await this.db.collection("workflow_runs").doc(runId).get();
    if (!snap.exists) return null;
    return WorkflowRunSchema.parse(snap.data());
  }

  async getAllWorkflowRuns(): Promise<WorkflowRun[]> {
    const snap = await this.db.collection("workflow_runs").get();
    return snap.docs.map((d) => WorkflowRunSchema.parse(d.data()));
  }

  async appendRunEvent(event: AuditEvent): Promise<AuditEvent> {
    const runRef = this.db.collection("workflow_runs").doc(event.workflowRunId);
    const eventRef = this.db.collection("run_events").doc(event.id);

    return await this.db.runTransaction(async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists) {
        throw new Error(
          `Run event with ID '${event.id}' already exists and cannot be overwritten (append-only violation).`
        );
      }

      const runSnap = await transaction.get(runRef);
      let sequence = event.sequence;
      let runData: WorkflowRun | null = null;

      if (runSnap.exists) {
        runData = WorkflowRunSchema.parse(runSnap.data());
        if (!sequence) {
          sequence = (runData.auditTrail?.length || 0) + 1;
        }
      } else {
        sequence = sequence || 1;
      }

      const sequencedEvent: AuditEvent = { ...event, sequence };
      const validatedEvent = RunEventEntitySchema.parse(sequencedEvent);

      transaction.set(eventRef, validatedEvent);

      if (runData) {
        const exists = runData.auditTrail.some((e) => e.id === validatedEvent.id);
        if (!exists) {
          runData.auditTrail.push(validatedEvent);
        }
        runData.lastEventAt = validatedEvent.timestamp || new Date().toISOString();
        transaction.set(runRef, runData);
      }
      return validatedEvent;
    });
  }

  async getRunEvents(runId: string): Promise<AuditEvent[]> {
    const snap = await this.db
      .collection("run_events")
      .where("workflowRunId", "==", runId)
      .get();
    const events = snap.docs.map((d) => RunEventEntitySchema.parse(d.data()));
    return events.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }

  async saveRunAndEventsBatch(options: SaveRunBatchOptions): Promise<WorkflowRun> {
    const runRef = this.db.collection("workflow_runs").doc(options.run.id);

    return await this.db.runTransaction(async (transaction) => {
      const validatedRun = WorkflowRunSchema.parse({
        ...options.run,
        lastEventAt: options.run.lastEventAt || new Date().toISOString(),
      });

      for (const ev of options.newEvents) {
        const eventRef = this.db.collection("run_events").doc(ev.id);
        const eventSnap = await transaction.get(eventRef);
        if (eventSnap.exists) {
          throw new Error(
            `Run event with ID '${ev.id}' already exists and cannot be overwritten (append-only violation).`
          );
        }
        const validatedEv = RunEventEntitySchema.parse(ev);
        transaction.set(eventRef, validatedEv);
      }

      transaction.set(runRef, validatedRun);

      if (options.activity) {
        const actRef = this.db.collection("workspace_activity").doc(options.activity.id);
        const actSnap = await transaction.get(actRef);
        if (actSnap.exists) {
          throw new Error(
            `Workspace activity with ID '${options.activity.id}' already exists and cannot be overwritten (append-only violation).`
          );
        }
        const validatedAct = WorkspaceActivityEntitySchema.parse(options.activity);
        transaction.set(actRef, validatedAct);
      }

      if (options.idempotencyKey) {
        const idempRef = this.db.collection("idempotency_records").doc(options.idempotencyKey);
        const idempSnap = await transaction.get(idempRef);
        if (idempSnap.exists) {
          const record = IdempotencyRecordSchema.parse(idempSnap.data());
          record.status = "completed";
          record.response = options.idempotencyResponse;
          record.completedAt = new Date().toISOString();
          transaction.set(idempRef, record);
        }
      }

      return validatedRun;
    });
  }

  async appendWorkspaceActivity(activity: WorkspaceActivity): Promise<WorkspaceActivity> {
    const validated = WorkspaceActivityEntitySchema.parse(activity);
    const docRef = this.db.collection("workspace_activity").doc(activity.id);
    return await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists) {
        throw new Error(
          `Workspace activity with ID '${validated.id}' already exists and cannot be overwritten (append-only violation).`
        );
      }
      transaction.set(docRef, validated);
      return validated;
    });
  }

  async getWorkspaceActivities(): Promise<WorkspaceActivity[]> {
    const snap = await this.db.collection("workspace_activity").get();
    const items = snap.docs.map((d) => WorkspaceActivityEntitySchema.parse(d.data()));
    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async saveConnection(connection: ConnectionCredential): Promise<ConnectionCredential> {
    const validated = ConnectionEntitySchema.parse(connection);
    await this.db.collection("connections").doc(connection.id).set(validated, { merge: true });
    return validated;
  }

  async getAllConnections(): Promise<ConnectionCredential[]> {
    const snap = await this.db.collection("connections").get();
    return snap.docs.map((d) => ConnectionEntitySchema.parse(d.data()));
  }

  async deleteConnection(connectionId: string): Promise<void> {
    await this.db.collection("connections").doc(connectionId).delete();
  }

  async checkOrSetIdempotency(
    key: string,
    requestHash?: string
  ): Promise<IdempotencyCheckResult> {
    const docRef = this.db.collection("idempotency_records").doc(key);

    return await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists) {
        const record = IdempotencyRecordSchema.parse(snap.data());
        if (record.status === "completed") {
          if (
            requestHash &&
            record.requestHash &&
            record.requestHash !== requestHash
          ) {
            throw new Error(
              `Idempotency key conflict: key '${key}' was already used with a different request payload.`
            );
          }
          return { isDuplicate: true, inProgress: false, record };
        }

        const isStale =
          record.status === "pending" &&
          Date.now() - new Date(record.createdAt).getTime() > 30000;

        if (record.status === "failed" || isStale) {
          const resetRecord: IdempotencyRecord = {
            ...record,
            requestHash,
            status: "pending",
            createdAt: new Date().toISOString(),
            response: undefined,
            completedAt: undefined,
          };
          const validated = IdempotencyRecordSchema.parse(resetRecord);
          transaction.set(docRef, validated);
          return { isDuplicate: false, inProgress: false, record: validated };
        }

        return { isDuplicate: true, inProgress: true, record };
      }

      const newRecord: IdempotencyRecord = {
        id: `idemp-${key}`,
        key,
        requestHash,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const validated = IdempotencyRecordSchema.parse(newRecord);
      transaction.set(docRef, validated);
      return { isDuplicate: false, inProgress: false, record: validated };
    });
  }

  async completeIdempotency(
    key: string,
    response?: Record<string, unknown>
  ): Promise<void> {
    const docRef = this.db.collection("idempotency_records").doc(key);
    await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists) {
        const record = IdempotencyRecordSchema.parse(snap.data());
        record.status = "completed";
        record.response = response;
        record.completedAt = new Date().toISOString();
        transaction.set(docRef, record);
      }
    });
  }

  async failIdempotency(key: string, errorReason: string): Promise<void> {
    const docRef = this.db.collection("idempotency_records").doc(key);
    await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists) {
        const record = IdempotencyRecordSchema.parse(snap.data());
        record.status = "failed";
        record.response = { error: errorReason };
        record.completedAt = new Date().toISOString();
        transaction.set(docRef, record);
      }
    });
  }
}

/**
 * Singleton factory for persistence adapter based on environment
 */
let persistenceAdapterInstance: IPersistenceAdapter | null = null;

export function getPersistenceAdapter(): IPersistenceAdapter {
  if (persistenceAdapterInstance) return persistenceAdapterInstance;

  const backend = process.env.PERSISTENCE_BACKEND;

  // Unit tests or explicit memory setting
  if (
    backend === "memory" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true"
  ) {
    persistenceAdapterInstance = new MemoryPersistenceAdapter();
    return persistenceAdapterInstance;
  }

  if (process.env.NODE_ENV === "production" && backend !== "firestore") {
    throw new Error(
      "Configuration Defect: Production environment mandates PERSISTENCE_BACKEND=firestore."
    );
  }

  // Explicit firestore setting or production mode requirement
  if (backend === "firestore") {
    try {
      persistenceAdapterInstance = new FirestorePersistenceAdapter();
      return persistenceAdapterInstance;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Persistence Failure: Firestore backend requested but failed to initialize: ${message}`
      );
    }
  }

  // Default fallback for dev sandbox environment
  persistenceAdapterInstance = new MemoryPersistenceAdapter();
  return persistenceAdapterInstance;
}

export function resetPersistenceAdapter(): void {
  persistenceAdapterInstance = null;
}
