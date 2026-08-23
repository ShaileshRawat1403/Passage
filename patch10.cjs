const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
  /const \{ workflowId, caseId, initialContext \} = req\.body;/,
  `const { workflowId, workflowVersion, workflowVersionHash, caseId, initialContext } = req.body;`
);

content = content.replace(
  /const result = await commandService\.createRun\(\s*workflowId,\s*caseId,\s*initialContext,\s*idempotencyKey\s*\);/,
  `const result = await commandService.createRun(
        workflowId,
        workflowVersion,
        workflowVersionHash,
        caseId,
        initialContext,
        idempotencyKey
      );`
);

fs.writeFileSync('server.ts', content);
