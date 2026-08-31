import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

import { parseWorkflowDefinition } from "./src/domain/parser";

dotenv.config();

export interface PassageAppOptions {
  seedData?: boolean;
}

export interface PassageRuntimeHandle {
  close: () => Promise<void>;
  port: number;
}

export async function createPassageApp(options: PassageAppOptions = {}) {
  const app = express();
  

  app.use(express.json({ limit: "10mb" }));

  // Middleware to derive workspace context (single-tenant local deployment)
  app.use((req, res, next) => {
    req.workspaceId = req.headers["x-workspace-id"] || "default-workspace";
    if (req.body && typeof req.body === 'object') {
      req.body.workspaceId = req.workspaceId;
    }
    next();
  });

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // P2.0 Persistence REST API Endpoints
  app.get("/api/workflows", async (_req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const workflows = await adapter.getAllWorkflows();
      res.json({ workflows });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const workflow = await adapter.getWorkflowHead(req.params.id);
      if (!workflow) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }
      res.json({ workflow });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/workflows", async (req, res) => {
    try {
      const { commandService } = await import("./src/services/commandService");
      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;
      const result = await commandService.saveWorkflow(req.body, idempotencyKey);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/workflows/:id/publish", async (req, res) => {
    try {
      const { commandService } = await import("./src/services/commandService");
      const { version } = req.body;
      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;
      const result = await commandService.publishWorkflowVersion(
        req.params.id,
        version || "1.0.0",
        idempotencyKey
      );
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      await adapter.deleteWorkflow(req.params.id);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/runs", async (_req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const runs = await adapter.getAllWorkflowRuns();
      res.json({ runs });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/runs/:id", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const run = await adapter.getWorkflowRun(req.params.id);
      if (!run) {
        res.status(404).json({ error: "Workflow run not found" });
        return;
      }
      res.json({ run });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/runs", async (req, res) => {
    try {
      const { commandService } = await import("./src/services/commandService");
      const { workflowId, workflowVersion, workflowVersionHash, caseId, initialContext } = req.body;
      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;
      const result = await commandService.createRun(
        workflowId,
        workflowVersion,
        workflowVersionHash,
        caseId,
        initialContext,
        idempotencyKey
      );
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/runs/:id/dispatch", async (req, res) => {
    try {
      const { commandService } = await import("./src/services/commandService");
      const { eventName, payload } = req.body;
      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;
      const result = await commandService.dispatchRunEvent(
        req.params.id,
        eventName,
        payload,
        idempotencyKey
      );
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/activity", async (_req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const activities = await adapter.getWorkspaceActivities();
      res.json({ activities });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/connections", async (_req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      res.json({ connections });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const { commandService } = await import("./src/services/commandService");
      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;
      const result = await commandService.saveConnection(req.body, idempotencyKey);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/connections/:id", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      await adapter.deleteConnection(req.params.id);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // P2.1 Provider API Routes
  app.post("/api/providers/:connectionId/test", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      const connection = connections.find((c) => c.id === req.params.connectionId);
      if (!connection) {
        res.status(404).json({ error: `Connection '${req.params.connectionId}' not found.` });
        return;
      }

      const { providerRegistry } = await import("./src/services/providers/registry");
      const health = await providerRegistry.testConnection(connection);
      
      // Update connection status in persistence if changed
      const newStatus = health.status === "verified" ? "verified" : "failed";
      if (connection.status !== newStatus) {
        connection.status = newStatus;
        await adapter.saveConnection(connection);
      }

      res.json(health);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/providers/:connectionId/models", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      const connection = connections.find((c) => c.id === req.params.connectionId);
      if (!connection) {
        res.status(404).json({ error: `Connection '${req.params.connectionId}' not found.` });
        return;
      }

      const { providerRegistry } = await import("./src/services/providers/registry");
      const models = await providerRegistry.listModels(connection);
      res.json({ models });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/providers/:connectionId/capabilities", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      const connection = connections.find((c) => c.id === req.params.connectionId);
      if (!connection) {
        res.status(404).json({ error: `Connection '${req.params.connectionId}' not found.` });
        return;
      }

      const { providerRegistry } = await import("./src/services/providers/registry");
      const capabilities = await providerRegistry.getCapabilities(connection);
      res.json({ capabilities });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/providers/:connectionId/generate", async (req, res) => {
    try {
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      const connection = connections.find((c) => c.id === req.params.connectionId);
      if (!connection) {
        res.status(404).json({ error: `Connection '${req.params.connectionId}' not found.` });
        return;
      }

      const { providerRegistry } = await import("./src/services/providers/registry");
      const llmResponse = await providerRegistry.generate(connection, req.body);
      res.json(llmResponse);
    } catch (err: unknown) {
      const { ProviderError } = await import("./src/domain/providers");
      if (err instanceof ProviderError) {
        res.status(err.statusCode || 400).json({
          error: err.message,
          code: err.code,
          provider: err.provider,
          retryable: err.retryable,
        });
        return;
      }
      res.status(500).json({ error: String(err) });
    }
  });

  // API Route: AI Natural Language Workflow Generator
  app.post("/api/workflow/generate", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description || typeof description !== "string") {
        res.status(400).json({ error: "Workflow description is required." });
        return;
      }

      const { providerRegistry } = await import("./src/services/providers/registry");
      const adapter = (await import("./src/services/persistenceAdapter")).getPersistenceAdapter();
      const connections = await adapter.getAllConnections();
      const aiConn = connections.find((c) => c.type === "agent_provider" && c.status === "configured");
      
      if (!aiConn) {
        res.status(400).json({ error: "No AI provider configured. Please add an AI Connection in the Connections tab first." });
        return;
      }

      const prompt = `You are a workflow architect expert for Passage (a durable visual state-machine workflow engine).
The user wants to generate a complete workflow based on this description:
"${description}"

Output a JSON object matching this TypeScript structure:
{
  "name": string (workflow name),
  "description": string (brief summary),
  "initialStateId": string (id of start state),
  "states": [
    {
      "id": string (kebab-case id),
      "name": string (human label),
      "description": string,
      "type": "start" | "atomic" | "decision" | "parallel" | "waiting" | "approval" | "final",
      "entryActions": [
        {
          "id": string,
          "name": string,
          "type": "audit" | "http" | "agent" | "notification" | "human_task" | "wait",
          "httpConfig": { "method": "GET"|"POST", "url": string }, // required if type == 'http'
          "agentConfig": { "agentName": string, "modelProvider": "Google DeepMind", "model": "gemini-3.6-flash", "systemInstructions": string }, // required if type == 'agent'
          "humanTaskConfig": { "assigneeRole": string, "dueHours": number, "options": ["APPROVE","REJECT"] } // required if type == 'human_task'
        }
      ],
      "activeActions": [],
      "exitActions": [],
      "transitions": [
        {
          "id": string,
          "sourceStateId": string (id of this state),
          "targetStateId": string,
          "event": string (e.g. WORKFLOW_STARTED, VALIDATION_PASSED, APPROVAL_RECEIVED, REJECTION_RECEIVED, TIMEOUT_REACHED),
          "guard": {
            "id": string,
            "name": string,
            "description": string,
            "logic": "ALL" | "ANY",
            "conditions": [
              { "id": string, "field": string, "operator": "equals" | "greater_than" | "less_than" | "is_true", "value": string | number | boolean }
            ]
          }
        }
      ],
      "timeout": { "durationMs": number, "event": "TIMEOUT_REACHED" } // optional for waiting/approval states
    }
  ],
  "questions": [string] // 2-3 questions asking for missing operational details (e.g. assignees, retry policies, thresholds)
}

IMPORTANT: Ensure there is exactly 1 'start' state, at least 1 'final' state, valid outgoing transitions for intermediate states, and meaningful state IDs.
Respond strictly with valid JSON. Do NOT include markdown code blocks.`;

      const llmRes = await providerRegistry.generate(aiConn, {
        model: "gemini-3.6-flash",
        messages: [{ role: "user", content: prompt }],
        responseFormat: { type: "json" },
      });

      const parsed = (llmRes.output.json || (llmRes.output.text ? JSON.parse(llmRes.output.text) : {})) as any;
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

      // Validate through Passage boundary parser
      const parseResult = parseWorkflowDefinition(parsed);
      if (!parseResult.success || !parseResult.workflow) {
        res.status(422).json({
          error: "Generated workflow failed contract validation.",
          errors: parseResult.errors,
          issues: parseResult.issues,
        });
        return;
      }

      res.json({
        workflow: parseResult.workflow,
        questions,
      });
    } catch (err: unknown) {
      console.error("Workflow Generation Error:", err);
      const message = err instanceof Error ? err.message : "Failed to generate workflow";
      res.status(500).json({ error: message });
    }
  });

  // API Route: AI Action Execution Placeholder (Governed AI Actions arrive in P2.2)
  app.post("/api/action/agent-execute", async (req, res) => {
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
        : `Context data:\n${JSON.stringify(context, null, 2)}\nPlease evaluate this context and output JSON.`;
      
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
  });

  // Vite middleware for dev or Static serve in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Seed initial workflows into durable persistence if explicit or if dev mode is empty
  const shouldSeed =
    process.env.SEED_SAMPLE_DATA === "true" ||
    (process.env.SEED_SAMPLE_DATA !== "false" && process.env.NODE_ENV !== "production");

  if (shouldSeed) {
    try {
      const { getPersistenceAdapter } = await import("./src/services/persistenceAdapter");
      const { commandService } = await import("./src/services/commandService");
      const { sampleWorkflows } = await import("./src/domain/sampleWorkflows");

      const adapter = getPersistenceAdapter();
      const existing = await adapter.getAllWorkflows();
      if (existing.length === 0) {
        for (const wf of sampleWorkflows) {
          await commandService.saveWorkflow(wf);
        }
        console.log(`[Stateflow Server] Seeded ${sampleWorkflows.length} sample workflows into durable store.`);
      }
    } catch (err) {
      console.warn("[Stateflow Server] Boot seed notice:", err);
    }
  }

  return app;
}

export async function startPassageRuntime(options: PassageAppOptions = {}): Promise<PassageRuntimeHandle> {
  const app = await createPassageApp(options);
  const PORT = parseInt(process.env.PASSAGE_PORT || process.env.PORT || "3000", 10);
  
  return new Promise((resolve) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Passage Runtime] Running at http://0.0.0.0:${PORT}`);
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
}


// Auto-start server unless in test environment
if (process.env.NODE_ENV !== 'test') {
  startPassageRuntime();
}
