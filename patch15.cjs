const fs = require('fs');
let content = fs.readFileSync('src/domain/parser.ts', 'utf-8');

content = content.replace(
  /const raw = JSON\.parse\(JSON\.stringify\(input\)\) as Record<string, unknown>;/,
  `let raw = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  
  if (raw.contract === "passage.workflow-document.v1" && raw.workflow) {
    const layout = raw.layout || {};
    raw = raw.workflow as Record<string, unknown>;
    
    // Inject layout positions back into the states
    if (Array.isArray(raw.states)) {
      raw.states.forEach((state: any) => {
        if (state.id && layout[state.id]) {
          state.position = layout[state.id].position;
        }
      });
    }
  }`
);

fs.writeFileSync('src/domain/parser.ts', content);
