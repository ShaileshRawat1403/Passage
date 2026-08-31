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
  sanitizeProviderError,
} from "../../domain/providers";

export class OpenAICompatibleAdapter implements LlmProvider {
  readonly kind: ProviderKind = "openai_compatible";

  private getClient(config: ResolvedProviderConfig): OpenAI {
    if (!config.baseUrl) {
      throw new ProviderError({
        message: "Base URL is required for OpenAI-compatible provider endpoints. Zero network calls permitted without explicit baseUrl.",
        code: "INVALID_REQUEST",
        provider: "openai_compatible",
        statusCode: 400,
      });
    }

    return new OpenAI({
      apiKey: config.apiKey || "local-bypass-key",
      baseURL: config.baseUrl,
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
      return models;
    } catch (err: unknown) {
      throw this.normalizeError(err, config);
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

  private normalizeError(err: unknown, config?: ResolvedProviderConfig): ProviderError {
    return sanitizeProviderError(err, "openai_compatible", [config?.apiKey]);
  }
}
