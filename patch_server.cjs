const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
  /async function startServer\(\) \{/,
  `export interface PassageAppOptions {
  seedData?: boolean;
}

export interface PassageRuntimeHandle {
  close: () => Promise<void>;
  port: number;
}

export async function createPassageApp(options: PassageAppOptions = {}) {`
);

content = content.replace(
  /app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{\n\s*console\.log\(`\[Stateflow Server\] Running at http:\/\/0\.0\.0\.0:\$\{PORT\}`\);\n\s*\}\);\n\}/,
  `return app;
}

export async function startPassageRuntime(options: PassageAppOptions = {}): Promise<PassageRuntimeHandle> {
  const app = await createPassageApp(options);
  const PORT = parseInt(process.env.PASSAGE_PORT || process.env.PORT || "3000", 10);
  
  return new Promise((resolve) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(\`[Passage Runtime] Running at http://0.0.0.0:\$\{PORT\}\`);
      resolve({
        port: PORT,
        close: async () => {
          return new Promise<void>((res, rej) => {
            server.close((err) => {
              if (err) rej(err);
              else res();
            });
          });
        }
      });
    });
  });
}`
);

content = content.replace(
  /startServer\(\);/,
  `import { pathToFileURL } from "url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startPassageRuntime();
}`
);

fs.writeFileSync('server.ts', content);
