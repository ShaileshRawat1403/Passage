const fs = require('fs');
let content = fs.readFileSync('src/services/commandService.ts', 'utf-8');

content = content.replace(
  /const wf = await this\.adapter\.getWorkflowHead\(run\.workflowId\);/,
  `const wf = await this.adapter.getWorkflowVersion(run.workflowId, run.workflowVersion);`
);

content = content.replace(
  /const errMsg = \`Workflow definition for \$\{run\.workflowId\} not found\`;/,
  `const errMsg = \`Workflow definition for \$\{run.workflowId\} version \$\{run.workflowVersion\} not found\`;`
);

fs.writeFileSync('src/services/commandService.ts', content);
