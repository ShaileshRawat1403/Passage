const fs = require('fs');
let content = fs.readFileSync('src/components/canvas/WorkflowCanvas.tsx', 'utf-8');

content = content.replace(
  /entryActions: template\.entryActions \|\| \[\]/,
  `entryActions: (template.entryActions || []).map(a => ({ ...a, id: "act-" + Date.now() + Math.random().toString(36).substring(2, 7) }))`
);

fs.writeFileSync('src/components/canvas/WorkflowCanvas.tsx', content);
