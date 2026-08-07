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

export class OllamaAdapter implements LlmProvider {
  readonly kind: ProviderKind = "ollama";

  private getBaseUrl(config: ResolvedProviderConfig): string {
    let url = config.baseUrl || "http://localhost:11434";
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
    return url;
  }

  async testConnection(config: ResolvedProviderConfig): Promise<ProviderHealth> {
    const startTime = Date.now();
    const baseUrl = this.getBaseUrl(config);

    try {
      const res = await fetch(`${baseUrl}/api/version`, {
        method: "GET",
        headers: { Accept: "application/json" },
      }).catch(async () => {
        // Fallback to /api/tags if /api/version not available
        return await fetch(`${baseUrl}/api/tags`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const latencyMs = Date.now() - startTime;
      return {
        status: "verified",
        checkedAt: new Date().toISOString(),
        latencyMs,
        provider: "ollama",
        resolvedBaseUrl: baseUrl,
        message: "Ollama server connection verified successfully.",
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const normalized = this.normalizeError(err, baseUrl);
      return {
        status: "unreachable",
        checkedAt: new Date().toISOString(),
        latencyMs,
        provider: "ollama",
        resolvedBaseUrl: baseUrl,
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
    const baseUrl = this.getBaseUrl(config);
    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return [{ id: config.defaultModel || "llama3", name: config.defaultModel || "Llama 3" }];
      }

      const data = (await res.json()) as { models?: Array<{ name: string; details?: { parameter_size?: string } }> };
      if (Array.isArray(data.models) && data.models.length > 0) {
        return data.models.map((m) => ({
          id: m.name,
          name: m.name,
          description: m.details?.parameter_size ? `Parameter size: ${m.details.parameter_size}` : undefined,
        }));
      }

      return [{ id: config.defaultModel || "llama3", name: config.defaultModel || "Llama 3" }];
    } catch (_err) {
      return [{ id: config.defaultModel || "llama3", name: config.defaultModel || "Llama 3" }];
    }
  }

  async generate(
    config: ResolvedProviderConfig,
    request: LlmRequest
  ): Promise<LlmResponse> {
    const startTime = new Date();
    const startMs = Date.now();
    const baseUrl = this.getBaseUrl(config);
    const model = request.model || config.defaultModel || "llama3";

    try {
      const messages = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body: Record<string, unknown> = {
        model,
        messages,
        stream: false,
      };

      if (request.responseFormat?.type === "json") {
        body.format = "json";
      }

      const options: Record<string, unknown> = {};
      if (request.temperature !== undefined) {
        options.temperature = request.temperature;
      }
      if (request.maxOutputTokens !== undefined) {
        options.num_predict = request.maxOutputTokens;
      }
      if (Object.keys(options).length > 0) {
        body.options = options;
      }

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (res.status === 404 || errText.includes("not found")) {
          throw new ProviderError({
            message: `Ollama Model Not Found: '${model}' on ${baseUrl}.`,
            code: "MODEL_NOT_FOUND",
            provider: "ollama",
            statusCode: 404,
          });
        }
        throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
      }

      const data = (await res.json()) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
        done_reason?: string;
      };

      const latencyMs = Date.now() - startMs;
      const completedAt = new Date();
      const rawText = data.message?.content || "";

      let jsonOutput: unknown = undefined;
      if (request.responseFormat?.type === "json") {
        try {
          jsonOutput = JSON.parse(rawText);
        } catch (_e) {
          throw new ProviderError({
            message: "Provider returned response that failed JSON format expectation.",
            code: "STRUCTURED_OUTPUT_INVALID",
            provider: "ollama",
            statusCode: 422,
          });
        }
      }

      const usageInfo =
        data.prompt_eval_count !== undefined || data.eval_count !== undefined
          ? {
              inputTokens: data.prompt_eval_count,
              outputTokens: data.eval_count,
              totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
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
      throw this.normalizeError(err, baseUrl);
    }
  }

  private normalizeError(err: unknown, baseUrl: string): ProviderError {
    return sanitizeProviderError(err, "ollama");
  }
}
