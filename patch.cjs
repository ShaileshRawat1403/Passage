const fs = require('fs');
let content = fs.readFileSync('src/domain/schemas.ts', 'utf-8');

content = content.replace(
  /export const WorkflowDefinitionSchema = z\.strictObject\(\{/,
  `export const WorkflowDefinitionSchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),`
);

content = content.replace(
  /export const AuditEventSchema = z\.strictObject\(\{/,
  `export const AuditEventSchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),`
);

content = content.replace(
  /export const WorkflowRunSchema = z\.strictObject\(\{/,
  `export const WorkflowRunSchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),
  workflowVersionHash: z.string().optional(),`
);

fs.writeFileSync('src/domain/schemas.ts', content);

let pContent = fs.readFileSync('src/domain/persistence.ts', 'utf-8');

pContent = pContent.replace(
  /export const WorkspaceActivityEntitySchema = z\.strictObject\(\{/,
  `export const WorkspaceActivityEntitySchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),`
);

pContent = pContent.replace(
  /export const ConnectionEntitySchema = z\.strictObject\(\{/,
  `export const ConnectionEntitySchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),`
);

pContent = pContent.replace(
  /export const IdempotencyRecordSchema = z\.strictObject\(\{/,
  `export const IdempotencyRecordSchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),`
);

fs.writeFileSync('src/domain/persistence.ts', pContent);
