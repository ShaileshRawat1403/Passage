import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  query,
  where,
  orderBy,
  Firestore,
} from "firebase/firestore";
import {
  WorkflowDefinition,
  WorkflowRun,
  AuditEvent,
  WorkspaceActivity,
  ConnectionCredential,
} from "../types/workflow";
import {
  WorkflowEntity,
  WorkflowVersionEntity,
  IdempotencyRecord,
} from "../domain/persistence";

import firebaseConfigRaw from "../../firebase-applet-config.json" assert { type: "json" };

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

  appendWorkspaceActivity(activity: WorkspaceActivity): Promise<WorkspaceActivity>;
  getWorkspaceActivities(): Promise<WorkspaceActivity[]>;

  saveConnection(connection: ConnectionCredential): Promise<ConnectionCredential>;
  getAllConnections(): Promise<ConnectionCredential[]>;
  deleteConnection(connectionId: string): Promise<void>;

  checkOrSetIdempotency(
    key: string,
    requestHash?: string
  ): Promise<{ isDuplicate: boolean; record?: IdempotencyRecord }>;
  completeIdempotency(
    key: string,
    response?: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Memory Storage fallback for tests / offline mode
 */
export class MemoryPersistenceAdapter implements IPersistenceAdapter {
  private workflows = new Map<string, WorkflowDefinition>();
  private versions = new Map<string, WorkflowVersionEntity>();
  private runs = new Map<string, WorkflowRun>();
  private runEvents: AuditEvent[] = [];
  private activities: WorkspaceActivity[] = [];
  private connections = new Map<string, ConnectionCredential>();
  private idempotencyRecords = new Map<string, IdempotencyRecord>();

  async saveWorkflowHead(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    this.workflows.set(workflow.id, { ...workflow, updatedAt: new Date().toISOString() });
    return this.workflows.get(workflow.id)!;
  }

  async getWorkflowHead(workflowId: string): Promise<WorkflowDefinition | null> {
    return this.workflows.get(workflowId) || null;
  }

  async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    return Array.from(this.workflows.values());
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    this.workflows.delete(workflowId);
  }

  async saveWorkflowVersion(
    workflowId: string,
    version: string,
    definition: WorkflowDefinition
  ): Promise<WorkflowVersionEntity> {
    const id = `${workflowId}_v${version}`;
    const versionEntity: WorkflowVersionEntity = {
      id,
      workflowId,
      version,
      definition,
      createdAt: new Date().toISOString(),
    };
    this.versions.set(id, versionEntity);
    return versionEntity;
  }

  async getWorkflowVersion(
    workflowId: string,
    version: string
  ): Promise<WorkflowDefinition | null> {
    const entity = this.versions.get(`${workflowId}_v${version}`);
    return entity ? entity.definition : null;
  }

  async saveWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
    this.runs.set(run.id, { ...run, lastEventAt: new Date().toISOString() });
    return this.runs.get(run.id)!;
  }

  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    return this.runs.get(runId) || null;
  }

  async getAllWorkflowRuns(): Promise<WorkflowRun[]> {
    return Array.from(this.runs.values());
  }

  async appendRunEvent(event: AuditEvent): Promise<AuditEvent> {
    this.runEvents.push(event);
    const run = this.runs.get(event.workflowRunId);
    if (run) {
      const exists = run.auditTrail.some((e) => e.id === event.id);
      if (!exists) {
        run.auditTrail.push(event);
      }
      run.lastEventAt = event.timestamp || new Date().toISOString();
    }
    return event;
  }

  async getRunEvents(runId: string): Promise<AuditEvent[]> {
    return this.runEvents.filter((e) => e.workflowRunId === runId);
  }

  async appendWorkspaceActivity(activity: WorkspaceActivity): Promise<WorkspaceActivity> {
    const existingIdx = this.activities.findIndex((a) => a.id === activity.id);
    if (existingIdx >= 0) {
      this.activities[existingIdx] = activity;
    } else {
      this.activities.unshift(activity);
    }
    return activity;
  }

  async getWorkspaceActivities(): Promise<WorkspaceActivity[]> {
    return [...this.activities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async saveConnection(connection: ConnectionCredential): Promise<ConnectionCredential> {
    this.connections.set(connection.id, connection);
    return connection;
  }

  async getAllConnections(): Promise<ConnectionCredential[]> {
    return Array.from(this.connections.values());
  }

  async deleteConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async checkOrSetIdempotency(
    key: string,
    requestHash?: string
  ): Promise<{ isDuplicate: boolean; record?: IdempotencyRecord }> {
    const existing = this.idempotencyRecords.get(key);
    if (existing) {
      return { isDuplicate: true, record: existing };
    }
    const newRecord: IdempotencyRecord = {
      id: `idemp-${key}`,
      key,
      requestHash,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.idempotencyRecords.set(key, newRecord);
    return { isDuplicate: false, record: newRecord };
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
 * Firestore Persistence Adapter
 */
export class FirestorePersistenceAdapter implements IPersistenceAdapter {
  private db: Firestore;

  constructor() {
    const config = {
      apiKey: firebaseConfigRaw.apiKey,
      projectId: firebaseConfigRaw.projectId,
      appId: firebaseConfigRaw.appId,
      authDomain: firebaseConfigRaw.authDomain,
    };
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    const dbId = firebaseConfigRaw.firestoreDatabaseId || "(default)";
    this.db = getFirestore(app, dbId);
  }

  async saveWorkflowHead(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const docRef = doc(this.db, "workflows", workflow.id);
    const updated = {
      ...workflow,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, updated, { merge: true });
    return updated;
  }

  async getWorkflowHead(workflowId: string): Promise<WorkflowDefinition | null> {
    const docRef = doc(this.db, "workflows", workflowId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as WorkflowDefinition;
  }

  async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    const colRef = collection(this.db, "workflows");
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as WorkflowDefinition);
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    const docRef = doc(this.db, "workflows", workflowId);
    await deleteDoc(docRef);
  }

  async saveWorkflowVersion(
    workflowId: string,
    version: string,
    definition: WorkflowDefinition
  ): Promise<WorkflowVersionEntity> {
    const id = `${workflowId}_v${version}`;
    const docRef = doc(this.db, "workflow_versions", id);
    const entity: WorkflowVersionEntity = {
      id,
      workflowId,
      version,
      definition,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, entity);
    return entity;
  }

  async getWorkflowVersion(
    workflowId: string,
    version: string
  ): Promise<WorkflowDefinition | null> {
    const id = `${workflowId}_v${version}`;
    const docRef = doc(this.db, "workflow_versions", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data() as WorkflowVersionEntity;
    return data.definition;
  }

  async saveWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
    const docRef = doc(this.db, "workflow_runs", run.id);
    const updated = {
      ...run,
      lastEventAt: new Date().toISOString(),
    };
    await setDoc(docRef, updated, { merge: true });
    return updated;
  }

  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    const docRef = doc(this.db, "workflow_runs", runId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as WorkflowRun;
  }

  async getAllWorkflowRuns(): Promise<WorkflowRun[]> {
    const colRef = collection(this.db, "workflow_runs");
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as WorkflowRun);
  }

  async appendRunEvent(event: AuditEvent): Promise<AuditEvent> {
    const docRef = doc(this.db, "run_events", event.id);
    await setDoc(docRef, event);

    // Update workflow run's local auditTrail snapshot as well
    const runDocRef = doc(this.db, "workflow_runs", event.workflowRunId);
    const snap = await getDoc(runDocRef);
    if (snap.exists()) {
      const run = snap.data() as WorkflowRun;
      const exists = run.auditTrail.some((e) => e.id === event.id);
      if (!exists) {
        run.auditTrail.push(event);
      }
      run.lastEventAt = event.timestamp || new Date().toISOString();
      await setDoc(runDocRef, run, { merge: true });
    }
    return event;
  }

  async getRunEvents(runId: string): Promise<AuditEvent[]> {
    const colRef = collection(this.db, "run_events");
    const q = query(colRef, where("workflowRunId", "==", runId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AuditEvent);
  }

  async appendWorkspaceActivity(activity: WorkspaceActivity): Promise<WorkspaceActivity> {
    const docRef = doc(this.db, "workspace_activity", activity.id);
    await setDoc(docRef, activity, { merge: true });
    return activity;
  }

  async getWorkspaceActivities(): Promise<WorkspaceActivity[]> {
    const colRef = collection(this.db, "workspace_activity");
    const snap = await getDocs(colRef);
    const items = snap.docs.map((d) => d.data() as WorkspaceActivity);
    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async saveConnection(connection: ConnectionCredential): Promise<ConnectionCredential> {
    const docRef = doc(this.db, "connections", connection.id);
    await setDoc(docRef, connection, { merge: true });
    return connection;
  }

  async getAllConnections(): Promise<ConnectionCredential[]> {
    const colRef = collection(this.db, "connections");
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as ConnectionCredential);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const docRef = doc(this.db, "connections", connectionId);
    await deleteDoc(docRef);
  }

  async checkOrSetIdempotency(
    key: string,
    requestHash?: string
  ): Promise<{ isDuplicate: boolean; record?: IdempotencyRecord }> {
    const docRef = doc(this.db, "idempotency_records", key);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { isDuplicate: true, record: snap.data() as IdempotencyRecord };
    }
    const record: IdempotencyRecord = {
      id: `idemp-${key}`,
      key,
      requestHash,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, record);
    return { isDuplicate: false, record };
  }

  async completeIdempotency(
    key: string,
    response?: Record<string, unknown>
  ): Promise<void> {
    const docRef = doc(this.db, "idempotency_records", key);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const record = snap.data() as IdempotencyRecord;
      record.status = "completed";
      record.response = response;
      record.completedAt = new Date().toISOString();
      await setDoc(docRef, record, { merge: true });
    }
  }
}

/**
 * Singleton factory for persistence adapter based on environment
 */
let persistenceAdapterInstance: IPersistenceAdapter | null = null;

export function getPersistenceAdapter(): IPersistenceAdapter {
  if (persistenceAdapterInstance) return persistenceAdapterInstance;

  // Use MemoryPersistenceAdapter when running in test runner (Vitest)
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    persistenceAdapterInstance = new MemoryPersistenceAdapter();
    return persistenceAdapterInstance;
  }

  try {
    if (firebaseConfigRaw && firebaseConfigRaw.projectId) {
      persistenceAdapterInstance = new FirestorePersistenceAdapter();
    } else {
      persistenceAdapterInstance = new MemoryPersistenceAdapter();
    }
  } catch (err) {
    console.warn("Falling back to MemoryPersistenceAdapter due to Firestore init issue:", err);
    persistenceAdapterInstance = new MemoryPersistenceAdapter();
  }
  return persistenceAdapterInstance;
}
