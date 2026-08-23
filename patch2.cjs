const fs = require('fs');
let pContent = fs.readFileSync('src/domain/persistence.ts', 'utf-8');

pContent = pContent.replace(
  /export const WorkflowVersionEntitySchema = z\.strictObject\(\{/,
  `export const WorkflowVersionEntitySchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),
  contentHash: z.string(),`
);

pContent = pContent.replace(
  /export const WorkflowEntitySchema = z\.strictObject\(\{/,
  `export const WorkflowEntitySchema = z.strictObject({
  workspaceId: z.string().default("default-workspace"),`
);

fs.writeFileSync('src/domain/persistence.ts', pContent);
