const fs = require('fs');
let content = fs.readFileSync('src/services/commandService.ts', 'utf-8');

// Update createRun signature
content = content.replace(
  /async createRun\(\s*workflowId: string,\s*caseId\?: string,\s*initialContext\?: Record<string, unknown>,\s*idempotencyKey\?: string\s*\): Promise<CommandResponse<WorkflowRun>> \{/,
  `async createRun(
    workflowId: string,
    workflowVersion: string,
    workflowVersionHash: string,
    caseId?: string,
    initialContext?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<CommandResponse<WorkflowRun>> {`
);

content = content.replace(
  /const requestHash = computeHash\(\{ workflowId, caseId, initialContext \}\);/,
  `const requestHash = computeHash({ workflowId, workflowVersion, workflowVersionHash, caseId, initialContext });`
);

content = content.replace(
  /const wf = await this\.adapter\.getWorkflowHead\(workflowId\);/,
  `const wf = await this.adapter.getWorkflowVersion(workflowId, workflowVersion);`
);

content = content.replace(
  /const errMsg = \`Workflow \$\{workflowId\} not found\`;/,
  `const errMsg = \`Workflow \$\{workflowId\} version \$\{workflowVersion\} not found\`;`
);

content = content.replace(
  /const newRun = createWorkflowRun\(wf, initialContext, actualCaseId\);/,
  `const newRun = createWorkflowRun(wf, initialContext, actualCaseId);
      newRun.workflowVersionHash = workflowVersionHash;
      newRun.workspaceId = wf.workspaceId || "default-workspace";`
);

fs.writeFileSync('src/services/commandService.ts', content);
