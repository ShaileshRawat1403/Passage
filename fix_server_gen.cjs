const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `const defaultGeminiConn = {
        id: "default-gemini",
        name: "Default Gemini",
        type: "agent_provider" as const,
        service: "gemini" as const,
        status: "configured" as const,
        defaultModel: "gemini-3.6-flash",
        apiKeyEnvVar: "GEMINI_API_KEY",
      };`;

const replacementStr = `const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      const aiConn = connections.find((c) => c.type === "agent_provider" && c.status === "configured");
      
      if (!aiConn) {
        res.status(400).json({ error: "No AI provider configured. Please add an AI Connection in the Connections tab first." });
        return;
      }`;

content = content.replace(targetStr, replacementStr);

content = content.replace(
  /const llmRes = await providerRegistry\.generate\(defaultGeminiConn, {/,
  `const llmRes = await providerRegistry.generate(aiConn, {`
);

fs.writeFileSync('server.ts', content);
