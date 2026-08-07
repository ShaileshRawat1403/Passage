import { GoogleGenAI } from "@google/genai";
import { LlmProvider } from "./provider";
import {
  ProviderKind,
  ResolvedProviderConfig,
  ProviderHealth,
  ProviderCapabilities,
  ModelDescriptor,
  LlmRequest,
  LlmResponse,
  ProviderError,
  sanitizeProviderError,
} from "../../domain/providers";

export class GeminiAdapter implements LlmProvider {
  readonly kind: ProviderKind = "gemini";

  private getClient(config: ResolvedProviderConfig): GoogleGenAI {
    if (!config.apiKey) {
      throw new ProviderError({
        message: "Gemini API key is missing or unresolved.",
        code: "AUTHENTICATION_FAILED",
        provider: "gemini",
        statusCode: 401,
      });
    }

    return new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "passage-p2.1-provider-adapter",
        },
      },
    });
  }

  async testConnection(config: ResolvedProviderConfig): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const client = this.getClient(config);
      const modelName = config.defaultModel || "gemini-3.6-flash";

      await client.models.generateContent({
        model: modelName,
        contents: "ping",
        config: {
          maxOutputTokens: 5,
        },
      });

      const latencyMs = Date.now() - startTime;
      return {
        status: "verified",
        checkedAt: new Date().toISOString(),
        latencyMs,
        provider: "gemini",
        message: "Gemini connection verified successfully.",
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const normalized = this.normalizeError(err);
      return {
        status:
          normalized.code === "AUTHENTICATION_FAILED"
            ? "authentication_failed"
            : "unreachable",
        checkedAt: new Date().toISOString(),
        latencyMs,
        provider: "gemini",
        message: normalized.message,
      };
    }
  }

  async getCapabilities(_config: ResolvedProviderConfig): Promise<ProviderCapabilities> {
    return {
      textGeneration: true,
      structuredOutput: true,
      toolCalling: true,
      streaming: true,
      multimodalInput: true,
      modelDiscovery: true,
    };
  }

  async listModels(_config: ResolvedProviderConfig): Promise<ModelDescriptor[]> {
    return [
      {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        description: "Fast and versatile multimodal model",
        contextWindow: 1048576,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "High performance lightweight model",
        contextWindow: 1048576,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Reasoning and complex task model",
        contextWindow: 2097152,
      },
    ];
  }

  async generate(
    config: ResolvedProviderConfig,
    request: LlmRequest
  ): Promise<LlmResponse> {
    const startTime = new Date();
    const startMs = Date.now();
    const client = this.getClient(config);
    const model = request.model || config.defaultModel || "gemini-3.6-flash";

    try {
      // Extract system instructions if present
      const systemMessage = request.messages.find((m) => m.role === "system");
      const userAndAssistantMessages = request.messages.filter((m) => m.role !== "system");

      const contents = userAndAssistantMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

      const reqConfig: Record<string, unknown> = {};
      if (systemMessage) {
        reqConfig.systemInstruction = systemMessage.content;
      }
      if (request.temperature !== undefined) {
        reqConfig.temperature = request.temperature;
      }
      if (request.maxOutputTokens !== undefined) {
        reqConfig.maxOutputTokens = request.maxOutputTokens;
      }
      if (request.responseFormat?.type === "json") {
        reqConfig.responseMimeType = "application/json";
      }

      const res = await client.models.generateContent({
        model,
        contents,
        config: reqConfig as any,
      });

      const latencyMs = Date.now() - startMs;
      const completedAt = new Date();
      const rawText = res.text || "";

      let jsonOutput: unknown = undefined;
      if (request.responseFormat?.type === "json") {
        try {
          jsonOutput = JSON.parse(rawText);
        } catch (_e) {
          throw new ProviderError({
            message: "Provider returned response that failed JSON format expectation.",
            code: "STRUCTURED_OUTPUT_INVALID",
            provider: "gemini",
            statusCode: 422,
          });
        }
      }

      const usageInfo = res.usageMetadata
        ? {
            inputTokens: res.usageMetadata.promptTokenCount,
            outputTokens: res.usageMetadata.candidatesTokenCount,
            totalTokens: res.usageMetadata.totalTokenCount,
          }
        : undefined;

      return {
        requestId: request.metadata?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        providerId: config.connectionId,
        modelRequested: request.model,
        modelResolved: model,
        output: {
          text: rawText,
          json: jsonOutput,
        },
        usage: usageInfo,
        finishReason: "stop",
        evidence: {
          startedAt: startTime.toISOString(),
          completedAt: completedAt.toISOString(),
          latencyMs,
        },
      };
    } catch (err: unknown) {
      if (err instanceof ProviderError) throw err;
      throw this.normalizeError(err);
    }
  }

  private normalizeError(err: unknown, config?: ResolvedProviderConfig): ProviderError {
    return sanitizeProviderError(err, "gemini", [config?.apiKey]);
  }
}
