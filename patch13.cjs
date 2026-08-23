const fs = require('fs');
let content = fs.readFileSync('src/store/workflowStore.ts', 'utf-8');

// Undo the mess
content = content.replace(/const API_BASE = import\.meta\.env\.VITE_API_BASE_URL \|\| "";\s*fetch\(`\$\{API_BASE\}\/api\//g, 'fetch("/api/');
content = content.replace(/await const API_BASE = import\.meta\.env\.VITE_API_BASE_URL \|\| "";\nfetch\(`\$\{API_BASE\}\/api\//g, 'await fetch("/api/');

// Now do it properly by just prepending to the literal string
content = content.replace(/fetch\("\/api\/([^"]+)"/g, 'fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/$1"');

fs.writeFileSync('src/store/workflowStore.ts', content);
