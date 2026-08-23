const fs = require('fs');
let content = fs.readFileSync('src/domain/runtime.ts', 'utf-8');

content = content.replace(
  /return \{\n\s*id: runId,/,
  `return {
    id: runId,
    workspaceId: workflow.workspaceId || "default-workspace",`
);

fs.writeFileSync('src/domain/runtime.ts', content);
