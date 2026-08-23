const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// A generic middleware to inject workspaceId
content = content.replace(
  /app\.use\(express\.json\(\{ limit: "10mb" \}\)\);/,
  `app.use(express.json({ limit: "10mb" }));

  // Middleware to derive workspace context (mocked until full auth)
  app.use((req, res, next) => {
    req.workspaceId = req.headers["x-workspace-id"] || "default-workspace";
    if (req.body && typeof req.body === 'object') {
      req.body.workspaceId = req.workspaceId;
    }
    next();
  });`
);

fs.writeFileSync('server.ts', content);
