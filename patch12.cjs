const fs = require('fs');
let content = fs.readFileSync('src/store/workflowStore.ts', 'utf-8');

const replacement = `const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
fetch(\`\$\{API_BASE\}/api/`;

content = content.replace(/fetch\("\/api\//g, replacement);

fs.writeFileSync('src/store/workflowStore.ts', content);

let mContent = fs.readFileSync('src/components/ai/DescribeWorkflowModal.tsx', 'utf-8');
mContent = mContent.replace(
  /fetch\("\/api\/workflow\/generate"/,
  `fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/workflow/generate"`
);
fs.writeFileSync('src/components/ai/DescribeWorkflowModal.tsx', mContent);
