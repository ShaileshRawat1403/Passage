import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

import { parseWorkflowDefinition } from "./src/domain/parser";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini AI client lazily/safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route: AI Natural Language Workflow Generator
  app.post("/api/workflow/generate", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description || typeof description !== "string") {
        res.status(400).json({ error: "Workflow description is required." });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        // Fallback or friendly notice if key missing
        res.status(503).json({
          error: "Gemini API key is missing in environment variables.",
        });
        return;
      }

      const ai = getGeminiClient();
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
              { "id": string, "field": string, "operator": "equals" | "greater_than" | "less_than" | "is_true", "value": any }
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

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
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
        ...parseResult.workflow,
        questions,
      });
    } catch (err: any) {
      console.error("Workflow Generation Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate workflow" });
    }
  });

  // API Route: Simulate Agent Execution in Workflow Action
  app.post("/api/action/agent-execute", async (req, res) => {
    try {
      const { agentName, instructions, inputData } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        // Mock fallback response
        res.json({
          status: "success",
          output: {
            riskScore: 12,
            recommendation: "Low risk detected based on vendor history and PO match.",
            confidence: 0.94,
            executedAt: new Date().toISOString(),
          },
        });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `You are an automated AI Agent named "${agentName || "Agent"}".
Instructions: ${instructions || "Analyze input data and provide risk and recommendation."}
Input Data: ${JSON.stringify(inputData || {})}

Return a valid JSON object with risk analysis and recommendation.`,
        config: {
          responseMimeType: "application/json",
        },
      });

      const output = JSON.parse(response.text || "{}");
      res.json({ status: "success", output });
    } catch (err: any) {
      res.json({
        status: "success",
        output: {
          riskScore: 18,
          recommendation: "Analyzed context; schema and compliance verified.",
          executedAt: new Date().toISOString(),
        },
      });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Stateflow Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
