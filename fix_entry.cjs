const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `import { pathToFileURL } from "url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startPassageRuntime();
}`;

const replacementStr = `
// Auto-start if executed directly (supports both ESM and CJS bundle execution)
const isMain = typeof require !== 'undefined' 
  ? require.main === module 
  : process.argv[1] && import.meta.url === require('url').pathToFileURL(process.argv[1]).href;

if (isMain) {
  startPassageRuntime();
}`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('server.ts', content);
