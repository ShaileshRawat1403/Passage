import OpenAI from "openai";
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
} from "../../domain/providers";

export class OpenAICompatibleAdapter implements LlmProvider {
  readonly kind: ProviderKind = "openai_compatible";

  private getClient(config: ResolvedProviderConfig): OpenAI {
    const baseUrl = config.baseUrl || "https://api.openai.com/v1";

    return new OpenAI({
      apiKey: config.apiKey || "dummy-key",
      baseURL: baseUrl,
    });
  }

  async testConnection(config: ResolvedProviderConfig): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      if (!config.baseUrl) {
        return {
          status: "misconfigured",
          checkedAt: new Date().toISOString(),
          provider: "openai_compatible",
          message: "Base URL is required for OpenAI-compatible provider endpoints.",
        };
      }

      const client = this.getClient(config);
      await client.models.list();

      const latencyMs = Date.now() - startTime;
      return {
        status: "verified",
        checkedAt: new Date().toISOString(),
        latencyMs,
        provider: "openai_compatible",
        resolvedBaseUrl: config.baseUrl,
        message: "OpenAI-compatible endpoint verified successfully.",
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
        provider: "openai_compatible",
        resolvedBaseUrl: config.baseUrl,
        message: normalized.message,
      };
    }
  }

  async getCapabilities(_config: ResolvedProviderConfig): Promise<ProviderCapabilities> {
    return {
      textGeneration: true,
      structuredOutput: true,
      toolCalling: false,
      streaming: true,
      multimodalInput: false,
      modelDiscovery: true,
    };
  }

  async listModels(config: ResolvedProviderConfig): Promise<ModelDescriptor[]> {
    try {
      const client = this.getClient(config);
      const res = await client.models.list();
      const models: ModelDescriptor[] = [];
      for await (const m of res.data) {
        models.push({
          id: m.id,
          name: m.id,
        });
      }
      return models.length > 0 ? models : [{ id: config.defaultModel || "custom-model", name: config.defaultModel || "Custom Model" }];
    } catch (_err) {
      return [{ id: config.defaultModel || "custom-model", name: config.defaultModel || "Custom Model" }];
    }
  }

  async generate(
    config: ResolvedProviderConfig,
    request: LlmRequest
  ): Promise<LlmResponse> {
    const startTime = new Date();
    const startMs = Date.now();
    const client = this.getClient(config);
    const model = request.model || config.defaultModel || "custom-model";

    try {
      const messages = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reqBody: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages,
      };

      if (request.temperature !== undefined) {
        reqBody.temperature = request.temperature;
      }
      if (request.maxOutputTokens !== undefined) {
        reqBody.max_tokens = request.maxOutputTokens;
      }
      if (request.responseFormat?.type === "json") {
        reqBody.response_format = { type: "json_object" };
      }

      const res = await client.chat.completions.create(reqBody);

      const latencyMs = Date.now() - startMs;
      const completedAt = new Date();
      const choice = res.choices[0];
      const rawText = choice?.message?.content || "";

      let jsonOutput: unknown = undefined;
      if (request.responseFormat?.type === "json") {
        try {
          jsonOutput = JSON.parse(rawText);
        } catch (_e) {
          throw new ProviderError({
            message: "Provider returned response that failed JSON format expectation.",
            code: "STRUCTURED_OUTPUT_INVALID",
            provider: "openai_compatible",
            statusCode: 422,
          });
        }
      }

      const usageInfo = res.usage
        ? {
            inputTokens: res.usage.prompt_tokens,
            outputTokens: res.usage.completion_tokens,
            totalTokens: res.usage.total_tokens,
          }
        : undefined;

      return {
        requestId: request.metadata?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        providerId: config.connectionId,
        modelRequested: request.model,
        modelResolved: res.model || model,
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

  private normalizeError(err: unknown): ProviderError {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("api key")) {
      return new ProviderError({
        message: `OpenAI-Compatible Auth Error: ${msg}`,
        code: "AUTHENTICATION_FAILED",
        provider: "openai_compatible",
        statusCode: 401,
      });
    }

    if (lower.includes("404") || lower.includes("not found")) {
      return new ProviderError({
        message: `OpenAI-Compatible Model/Endpoint Not Found: ${msg}`,
        code: "MODEL_NOT_FOUND",
        provider: "openai_compatible",
        statusCode: 404,
      });
    }

    if (lower.includes("429") || lower.includes("rate limit")) {
      return new ProviderError({
        message: `OpenAI-Compatible Rate Limited: ${msg}`,
        code: "RATE_LIMITED",
        provider: "openai_compatible",
        retryable: true,
        statusCode: 429,
      });
    }

    if (lower.includes("econnrefused") || lower.includes("unreachable") || lower.includes("fetch failed")) {
      return new ProviderError({
        message: `OpenAI-Compatible Endpoint Unreachable: ${msg}`,
        code: "PROVIDER_UNREACHABLE",
        provider: "openai_compatible",
        retryable: true,
      });
    }

    return new ProviderError({
      message: `OpenAI-Compatible Provider Error: ${msg}`,
      code: "PROVIDER_ERROR",
      provider: "openai_compatible",
    });
  }
}
