const fs = require('fs');
let pContent = fs.readFileSync('src/services/commandService.ts', 'utf-8');

pContent = pContent.replace(
  /const savedHead = await this\.adapter\.publishWorkflowVersionAtomic\(\{/,
  `const savedHead = await this.adapter.publishWorkflowVersionAtomic({
        contentHash: computeHash(updatedHead),`
);

fs.writeFileSync('src/services/commandService.ts', pContent);
