const fs = require('fs');
let content = fs.readFileSync('src/components/canvas/QuickAddSidebar.tsx', 'utf-8');

content = content.replace(
  /id: "act-" \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 7\),/,
  `// id will be generated on drop\n                id: "",`
);

fs.writeFileSync('src/components/canvas/QuickAddSidebar.tsx', content);
