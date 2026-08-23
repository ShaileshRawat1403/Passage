const fs = require('fs');
const glob = require('glob'); // Not available? I'll just list them manually.

const files = [
  'tests/app_initialization.test.ts',
  'tests/basic_workflow.test.ts',
  'tests/passage_home.test.ts',
  'tests/persistence_p2.test.ts',
  'tests/planner.test.ts',
  'tests/provider_p2_1.test.ts',
  'tests/workspace_overview.test.ts',
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    
    // Inject workspaceId: "default-workspace", everywhere an id: "..." is found for objects that look like they need it.
    // Instead of regex hacking, I'll just do a global replace for `id: "`, and add `workspaceId: "default-workspace", ` next to it.
    // But maybe that's too aggressive.
    content = content.replace(/id: "([^"]+)",/g, 'id: "$1",\n    workspaceId: "default-workspace",');
    
    fs.writeFileSync(file, content);
  }
}
