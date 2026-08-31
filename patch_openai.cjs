const fs = require('fs');
let content = fs.readFileSync('src/services/providers/openaiCompatibleAdapter.ts', 'utf-8');

content = content.replace(
  /apiKey: config\.apiKey \|\| "dummy-key",/,
  `apiKey: config.apiKey || "local-bypass-key",`
);

fs.writeFileSync('src/services/providers/openaiCompatibleAdapter.ts', content);
