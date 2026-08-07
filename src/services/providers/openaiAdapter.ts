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

export class OpenAIAdapter implements LlmProvider {
  readonly kind: ProviderKind = "openai";

  private getClient(config: ResolvedProviderConfig): OpenAI {
    if (!config.apiKey) {
      throw new ProviderError({
        message: "OpenAI API key is missing or unresolved.",
        code: "AUTHENTICATION_FAILED",
        provider: "openai",
        statusCode: 401,
      });
    }

    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }

  async testConnection(config: ResolvedProviderConfig): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const client = this.getClient(config);
      await client.models.list();

      const latencyMs = Date.now() - startTime;
      return {
        status: "verified",
        checkedAt: new Date().toISOString(),
        latencyMs,
        provider: "openai",
        message: "OpenAI connection verified successfully.",
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
        provider: "openai",
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

  async listModels(config: ResolvedProviderConfig): Promise<ModelDescriptor[]> {
    try {
      const client = this.getClient(config);
      const res = await client.models.list();
      const models: ModelDescriptor[] = [];
      for await (const m of res.data) {
        if (m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3")) {
          models.push({
            id: m.id,
            name: m.id,
          });
        }
      }
      return models.length > 0
        ? models
        : [
            { id: "gpt-4o", name: "GPT-4o" },
            { id: "gpt-4o-mini", name: "GPT-4o Mini" },
          ];
    } catch (_err) {
      return [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      ];
    }
  }

  async generate(
    config: ResolvedProviderConfig,
    request: LlmRequest
  ): Promise<LlmResponse> {
    const startTime = new Date();
    const startMs = Date.now();
    const client = this.getClient(config);
    const model = request.model || config.defaultModel || "gpt-4o-mini";

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
            provider: "openai",
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

      let finishReason: "stop" | "length" | "tool_call" | "content_filter" | "unknown" = "stop";
      if (choice?.finish_reason === "length") finishReason = "length";
      else if (choice?.finish_reason === "tool_calls") finishReason = "tool_call";
      else if (choice?.finish_reason === "content_filter") finishReason = "content_filter";

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
        finishReason,
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

    if (lower.includes("incorrect api key") || lower.includes("401") || lower.includes("invalid_api_key")) {
      return new ProviderError({
        message: `OpenAI Authentication Error: ${msg}`,
        code: "AUTHENTICATION_FAILED",
        provider: "openai",
        statusCode: 401,
      });
    }

    if (lower.includes("404") || lower.includes("model_not_found")) {
      return new ProviderError({
        message: `OpenAI Model Not Found: ${msg}`,
        code: "MODEL_NOT_FOUND",
        provider: "openai",
        statusCode: 404,
      });
    }

    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
      return new ProviderError({
        message: `OpenAI Rate Limited: ${msg}`,
        code: "RATE_LIMITED",
        provider: "openai",
        retryable: true,
        statusCode: 429,
      });
    }

    if (lower.includes("timeout") || lower.includes("etimedout")) {
      return new ProviderError({
        message: `OpenAI Request Timeout: ${msg}`,
        code: "TIMEOUT",
        provider: "openai",
        retryable: true,
        statusCode: 408,
      });
    }

    return new ProviderError({
      message: `OpenAI Provider Error: ${msg}`,
      code: "PROVIDER_ERROR",
      provider: "openai",
    });
  }
}
