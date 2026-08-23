const fs = require('fs');
let pContent = fs.readFileSync('src/services/persistenceAdapter.ts', 'utf-8');

pContent = pContent.replace(
  /export interface PublishVersionAtomicOptions \{/,
  `export interface PublishVersionAtomicOptions {
  contentHash: string;`
);

pContent = pContent.replace(
  /const versionEntity: WorkflowVersionEntity = \{[\s\S]*?createdAt: new Date\(\)\.toISOString\(\),[\s\S]*?\};/g,
  `const versionEntity: WorkflowVersionEntity = {
      id: versionKey,
      workflowId: options.workflowId,
      workspaceId: options.definition.workspaceId || "default-workspace",
      contentHash: options.contentHash,
      version: options.version,
      definition: options.definition,
      createdAt: new Date().toISOString(),
    };`
);

fs.writeFileSync('src/services/persistenceAdapter.ts', pContent);
