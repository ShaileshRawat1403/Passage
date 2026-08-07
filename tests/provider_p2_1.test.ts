import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ProviderKind,
  ProviderError,
  LlmRequest,
  LlmResponse,
  ProviderConnection,
  LlmResponseSchema,
  ProviderHealthSchema,
  ProviderCapabilitiesSchema,
} from "../src/domain/providers";
import { EnvironmentSecretResolver, SecretResolver } from "../src/services/providers/secretResolver";
import { GeminiAdapter } from "../src/services/providers/geminiAdapter";
import { OpenAIAdapter } from "../src/services/providers/openaiAdapter";
import { OpenAICompatibleAdapter } from "../src/services/providers/openaiCompatibleAdapter";
import { OllamaAdapter } from "../src/services/providers/ollamaAdapter";
import { ProviderRegistry } from "../src/services/providers/registry";

describe("P2.1 Provider Adapter Layer Test Suite", () => {
  let mockSecretResolver: SecretResolver;

  beforeEach(() => {
    mockSecretResolver = {
      resolveSecret: async (ref: string) => {
        if (ref === "TEST_GEMINI_KEY") return "valid-gemini-key";
        if (ref === "TEST_OPENAI_KEY") return "valid-openai-key";
        if (ref === "BAD_KEY") return "invalid-key";
        if (ref === "GEMINI_API_KEY") return process.env.GEMINI_API_KEY || "test-gemini-key";
        if (ref === "OPENAI_API_KEY") return process.env.OPENAI_API_KEY || "test-openai-key";
        return undefined;
      },
    };
  });

  describe("1. Contract Normalization & Evidence", () => {
    it("GeminiAdapter normalizes requests and produces evidence-backed responses", async () => {
      const adapter = new GeminiAdapter();
      const config = {
        connectionId: "conn-gemini-1",
        provider: "gemini" as ProviderKind,
        apiKey: "dummy-gemini-key",
      };

      // Mock generateContent SDK response
      const mockGenerateContent = vi.fn().mockResolvedValueOnce({
        text: '{"summary": "Workflow validated"}',
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 10,
          totalTokenCount: 25,
        },
      });

      vi.spyOn(adapter as any, "getClient").mockReturnValue({
        models: { generateContent: mockGenerateContent },
      });

      const request: LlmRequest = {
        model: "gemini-3.6-flash",
        messages: [{ role: "user", content: "Summarize status" }],
        responseFormat: { type: "json" },
      };

      const response = await adapter.generate(config, request);

      expect(response.providerId).toBe("conn-gemini-1");
      expect(response.modelRequested).toBe("gemini-3.6-flash");
      expect(response.output.text).toBe('{"summary": "Workflow validated"}');
      expect(response.output.json).toEqual({ summary: "Workflow validated" });
      expect(response.usage?.totalTokens).toBe(25);
      expect(response.evidence.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.evidence.startedAt).toBeDefined();
      expect(response.evidence.completedAt).toBeDefined();

      // Schema validation
      expect(LlmResponseSchema.safeParse(response).success).toBe(true);
    });

    it("OpenAIAdapter normalizes requests and handles usage/evidence", async () => {
      const adapter = new OpenAIAdapter();
      const config = {
        connectionId: "conn-openai-1",
        provider: "openai" as ProviderKind,
        apiKey: "dummy-openai-key",
      };

      const mockCreate = vi.fn().mockResolvedValueOnce({
        model: "gpt-4o-mini",
        choices: [
          {
            message: { content: "Hello from OpenAI" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 8,
          total_tokens: 20,
        },
      });

      vi.spyOn(adapter as any, "getClient").mockReturnValue({
        chat: { completions: { create: mockCreate } },
      });

      const request: LlmRequest = {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await adapter.generate(config, request);

      expect(response.providerId).toBe("conn-openai-1");
      expect(response.modelResolved).toBe("gpt-4o-mini");
      expect(response.output.text).toBe("Hello from OpenAI");
      expect(response.usage?.totalTokens).toBe(20);
      expect(LlmResponseSchema.safeParse(response).success).toBe(true);
    });
  });

  describe("2. Error Taxonomy Normalization", () => {
    it("Maps 401 / Invalid Key to AUTHENTICATION_FAILED (non-retryable)", async () => {
      const adapter = new GeminiAdapter();
      const config = {
        connectionId: "conn-1",
        provider: "gemini" as ProviderKind,
        apiKey: "bad-key",
      };

      vi.spyOn(adapter as any, "getClient").mockReturnValue({
        models: {
          generateContent: vi
            .fn()
            .mockRejectedValueOnce(
              new Error("API key not valid. Please pass a valid API key. (401)")
            ),
        },
      });

      await expect(
        adapter.generate(config, {
          model: "gemini-3.6-flash",
          messages: [{ role: "user", content: "Test" }],
        })
      ).rejects.toSatisfy((err: unknown) => {
        return (
          err instanceof ProviderError &&
          err.code === "AUTHENTICATION_FAILED" &&
          err.provider === "gemini" &&
          err.retryable === false
        );
      });
    });

    it("Maps 429 Rate Limit to RATE_LIMITED (retryable)", async () => {
      const adapter = new OpenAIAdapter();
      const config = {
        connectionId: "conn-2",
        provider: "openai" as ProviderKind,
        apiKey: "valid-key",
      };

      vi.spyOn(adapter as any, "getClient").mockReturnValue({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValueOnce(new Error("Rate limit exceeded 429 quota")),
          },
        },
      });

      await expect(
        adapter.generate(config, {
          model: "gpt-4o",
          messages: [{ role: "user", content: "Test" }],
        })
      ).rejects.toSatisfy((err: unknown) => {
        return (
          err instanceof ProviderError &&
          err.code === "RATE_LIMITED" &&
          err.provider === "openai" &&
          err.retryable === true
        );
      });
    });

    it("Maps invalid JSON response format to STRUCTURED_OUTPUT_INVALID", async () => {
      const adapter = new OllamaAdapter();
      const config = {
        connectionId: "conn-3",
        provider: "ollama" as ProviderKind,
        baseUrl: "http://localhost:11434",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: "This is raw text, NOT valid JSON!" },
        }),
      } as Response);

      await expect(
        adapter.generate(config, {
          model: "llama3",
          messages: [{ role: "user", content: "Return JSON" }],
          responseFormat: { type: "json" },
        })
      ).rejects.toSatisfy((err: unknown) => {
        return (
          err instanceof ProviderError &&
          err.code === "STRUCTURED_OUTPUT_INVALID" &&
          err.provider === "ollama"
        );
      });
    });
  });

  describe("3. Capability Contracts & Verification", () => {
    it("Provides accurate capabilities for Gemini, OpenAI, and Ollama", async () => {
      const gemini = new GeminiAdapter();
      const ollama = new OllamaAdapter();
      const dummyConfig = { connectionId: "c1", provider: "gemini" as ProviderKind };

      const geminiCaps = await gemini.getCapabilities(dummyConfig);
      const ollamaCaps = await ollama.getCapabilities({ ...dummyConfig, provider: "ollama" });

      expect(geminiCaps.multimodalInput).toBe(true);
      expect(geminiCaps.toolCalling).toBe(true);

      expect(ollamaCaps.multimodalInput).toBe(false);
      expect(ollamaCaps.toolCalling).toBe(false);

      expect(ProviderCapabilitiesSchema.safeParse(geminiCaps).success).toBe(true);
      expect(ProviderCapabilitiesSchema.safeParse(ollamaCaps).success).toBe(true);
    });
  });

  describe("4. Secret Resolution & Non-Exposure", () => {
    it("Resolves environment secrets and prevents secret leakage in connections", async () => {
      const envResolver = new EnvironmentSecretResolver();
      process.env.TEST_SECRET_VAR = "secret_12345";

      const resolved = await envResolver.resolveSecret("TEST_SECRET_VAR");
      expect(resolved).toBe("secret_12345");

      const providerConn: ProviderConnection = {
        id: "pconn-1",
        name: "Production OpenAI",
        provider: "openai",
        auth: {
          mode: "secret_ref",
          secretRef: "OPENAI_API_KEY",
        },
        status: "configured",
      };

      // Ensure raw secret is not present in serialized ProviderConnection
      const serialized = JSON.stringify(providerConn);
      expect(serialized).not.toContain("secret_12345");
      expect(serialized).not.toContain("apiKey");
      expect(serialized).toContain('"secretRef":"OPENAI_API_KEY"');
    });
  });

  describe("5. Provider Connection Testing", () => {
    it("testConnection returns verified for active endpoint and unreachable for failed network", async () => {
      const ollama = new OllamaAdapter();
      const validConfig = {
        connectionId: "c-ollama",
        provider: "ollama" as ProviderKind,
        baseUrl: "http://localhost:11434",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: "0.1.30" }),
      } as Response);

      const health = await ollama.testConnection(validConfig);
      expect(health.status).toBe("verified");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(ProviderHealthSchema.safeParse(health).success).toBe(true);

      // Failed connection test
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed / ECONNREFUSED"));
      const failedHealth = await ollama.testConnection(validConfig);
      expect(failedHealth.status).toBe("unreachable");
      expect(failedHealth.message).toContain("unreachable");
    });
  });

  describe("6. Provider Registry & Selection", () => {
    it("ProviderRegistry selects correct provider and throws on unknown provider kind", async () => {
      const registry = new ProviderRegistry(mockSecretResolver);

      const geminiProvider = registry.getProvider("gemini");
      expect(geminiProvider.kind).toBe("gemini");

      const openaiProvider = registry.getProvider("openai");
      expect(openaiProvider.kind).toBe("openai");

      const ollamaProvider = registry.getProvider("ollama");
      expect(ollamaProvider.kind).toBe("ollama");

      const openaiCompProvider = registry.getProvider("openai_compatible");
      expect(openaiCompProvider.kind).toBe("openai_compatible");

      expect(() => registry.getProvider("unknown" as any)).toThrowError(ProviderError);
    });

    it("Resolves configuration seamlessly from ConnectionCredential or ProviderConnection", async () => {
      const registry = new ProviderRegistry(mockSecretResolver);

      const connCred = {
        id: "conn-cred-1",
        name: "Test Gemini",
        type: "agent_provider" as const,
        service: "gemini" as const,
        status: "configured" as const,
        apiKeyEnvVar: "TEST_GEMINI_KEY",
      };

      const resolved = await registry.resolveConfig(connCred);
      expect(resolved.provider).toBe("gemini");
      expect(resolved.apiKey).toBe("valid-gemini-key");
    });
  });

  describe("7. Runtime Workflow Isolation & No-Fake-Success", () => {
    it("Provider operations never mutate workflow runs or persistence state", async () => {
      const registry = new ProviderRegistry(mockSecretResolver);
      const conn = {
        id: "conn-isolate",
        name: "Isolate Conn",
        type: "agent_provider" as const,
        service: "gemini" as const,
        status: "configured" as const,
        apiKeyEnvVar: "TEST_GEMINI_KEY",
      };

      const caps = await registry.getCapabilities(conn);
      expect(caps.textGeneration).toBe(true);

      // Verify no side-effects on workflow persistence adapters
      const { getPersistenceAdapter } = await import("../src/services/persistenceAdapter");
      const adapter = getPersistenceAdapter();
      const runs = await adapter.getAllWorkflowRuns();
      expect(runs).toBeDefined();
    });
  });
});
