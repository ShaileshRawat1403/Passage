import { z } from "zod";
import {
  WorkflowDefinitionSchema,
  WorkflowRunSchema,
  AuditEventSchema,
} from "./schemas";
import {
  WorkflowDefinition,
  WorkflowRun,
  AuditEvent,
  WorkspaceActivity,
  ConnectionCredential,
} from "../types/workflow";

/**
 * P2.0 Persistence Contracts & Durable Entities
 */

export const WorkflowEntitySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  currentVersion: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  headDefinition: WorkflowDefinitionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkflowEntity = z.infer<typeof WorkflowEntitySchema>;

export const WorkflowVersionEntitySchema = z.strictObject({
  id: z.string(), // e.g. `${workflowId}_v${version}`
  workflowId: z.string(),
  version: z.string(),
  definition: WorkflowDefinitionSchema,
  createdAt: z.string(),
});

export type WorkflowVersionEntity = z.infer<typeof WorkflowVersionEntitySchema>;

export const RunEventEntitySchema = AuditEventSchema;
export type RunEventEntity = AuditEvent;

export const WorkspaceActivityEntitySchema = z.strictObject({
  id: z.string(),
  timestamp: z.string(),
  category: z.enum([
    "workflow_creation",
    "workflow_import",
    "designer_edit",
    "run_event",
    "connection",
    "system",
  ]),
  action: z.string(),
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  details: z.string(),
  actor: z.string().optional(),
  severity: z.enum(["info", "success", "warning", "error"]).optional(),
  isDemo: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type WorkspaceActivityEntity = WorkspaceActivity;

export const ConnectionEntitySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  type: z.enum(["api_key", "oauth2", "basic_auth", "agent_provider", "webhook"]),
  service: z.string(),
  status: z.enum([
    "configured",
    "untested",
    "available_local",
    "unavailable",
    "verified",
    "failed",
    "connected",
    "disconnected",
    "testing",
  ]),
  lastTestedAt: z.string().optional(),
  defaultModel: z.string().optional(),
  providerId: z.string().optional(),
});

export type ConnectionEntity = ConnectionCredential;

export const IdempotencyRecordSchema = z.strictObject({
  id: z.string(),
  key: z.string(),
  workflowRunId: z.string().optional(),
  actionId: z.string().optional(),
  requestHash: z.string().optional(),
  response: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["pending", "completed", "failed"]),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>;
