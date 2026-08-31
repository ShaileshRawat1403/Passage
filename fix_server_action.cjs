const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `app.post("/api/action/agent-execute", async (_req, res) => {
    res.status(501).json({
      error: "Governed AI Actions execution arrives in milestone P2.2.",
    });
  });`;

const replacementStr = `app.post("/api/action/agent-execute", async (req, res) => {
    try {
      const { agentName, model, systemInstructions, prompt, context } = req.body;
      
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      const aiConn = connections.find((c) => c.type === "agent_provider" && c.status === "configured");
      
      if (!aiConn) {
        res.status(400).json({ error: "No AI provider configured for agent execution." });
        return;
      }
      
      const { providerRegistry } = await import("./src/services/providers/registry");
      
      const finalPrompt = prompt 
        ? prompt 
        : \`Context data:\\n\${JSON.stringify(context, null, 2)}\\nPlease evaluate this context and output JSON.\`;
      
      const llmRes = await providerRegistry.generate(aiConn, {
        model: model || aiConn.defaultModel || "custom-model",
        messages: [
          ...(systemInstructions ? [{ role: "system" as const, content: systemInstructions }] : []),
          { role: "user" as const, content: finalPrompt }
        ],
        responseFormat: { type: "json" }
      });
      
      res.json(llmRes);
    } catch (err: unknown) {
      console.error("Agent Execution Error:", err);
      res.status(500).json({ error: String(err) });
    }
  });`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('server.ts', content);
