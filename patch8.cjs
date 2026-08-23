const fs = require('fs');
let content = fs.readFileSync('src/services/commandService.ts', 'utf-8');

content = content.replace(
  /const errMsg = \`Workflow \$\{workflowId\} version \$\{workflowVersion\} not found\`;/,
  `const errMsg = \`Workflow \$\{workflowId\} version \$\{workflowVersion\} not found\`;
        if (idempotencyKey) await this.adapter.failIdempotency(idempotencyKey, errMsg);
        return { success: false, error: errMsg };
      }
      
      const computedHash = computeHash(wf);
      if (computedHash !== workflowVersionHash) {
        const errMsg = \`Mismatched content hash for workflow \$\{workflowId\} version \$\{workflowVersion\}\`;`
);

fs.writeFileSync('src/services/commandService.ts', content);
