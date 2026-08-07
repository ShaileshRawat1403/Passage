import { z } from "zod";
import { LlmProvider } from "./provider";
import { GeminiAdapter } from "./geminiAdapter";
import { OpenAIAdapter } from "./openaiAdapter";
import { OpenAICompatibleAdapter } from "./openaiCompatibleAdapter";
import { OllamaAdapter } from "./ollamaAdapter";
import { SecretResolver, EnvironmentSecretResolver } from "./secretResolver";
import {
  ProviderKind,
  ResolvedProviderConfig,
  ProviderHealth,
  ProviderHealthSchema,
  ProviderCapabilities,
  ProviderCapabilitiesSchema,
  ModelDescriptor,
  ModelDescriptorSchema,
  LlmRequest,
  LlmRequestSchema,
  LlmResponse,
  LlmResponseSchema,
  ProviderError,
  ProviderConnection,
  sanitizeProviderError,
} from "../../domain/providers";
import { ConnectionCredential } from "../../types/workflow";

export class ProviderRegistry {
  private providers: Map<ProviderKind, LlmProvider> = new Map();
  private defaultSecretResolver: SecretResolver;

  constructor(secretResolver?: SecretResolver) {
    this.defaultSecretResolver = secretResolver || new EnvironmentSecretResolver();

    this.registerProvider(new GeminiAdapter());
    this.registerProvider(new OpenAIAdapter());
    this.registerProvider(new OpenAICompatibleAdapter());
    this.registerProvider(new OllamaAdapter());
  }

  registerProvider(provider: LlmProvider): void {
    this.providers.set(provider.kind, provider);
  }

  getProvider(kind: ProviderKind): LlmProvider {
    const p = this.providers.get(kind);
    if (!p) {
      throw new ProviderError({
        message: `No registered provider adapter for provider kind '${kind}'.`,
        code: "CAPABILITY_UNSUPPORTED",
        provider: kind,
      });
    }
    return p;
  }

  async resolveConfig(
    connection: ConnectionCredential | ProviderConnection,
    secretResolver?: SecretResolver
  ): Promise<ResolvedProviderConfig> {
    const resolver = secretResolver || this.defaultSecretResolver;
    let kind: ProviderKind = "gemini";

    // 1. Determine provider kind from ProviderConnection shape or ConnectionCredential shape
    if ("provider" in connection && connection.provider) {
      const p = connection.provider;
      if (p === "gemini" || p === "openai" || p === "openai_compatible" || p === "ollama") {
        kind = p;
      }
    } else {
      const providerId = "providerId" in connection ? (connection as any).providerId : undefined;
      const service = "service" in connection ? (connection as any).service : undefined;

      const candidateStr = `${providerId || ""} ${service || ""}`.toLowerCase();

      if (candidateStr.includes("ollama")) {
        kind = "ollama";
      } else if (
        candidateStr.includes("openai_compatible") ||
        candidateStr.includes("openrouter") ||
        candidateStr.includes("custom_http") ||
        candidateStr.includes("groq") ||
        candidateStr.includes("together") ||
        candidateStr.includes("vllm") ||
        candidateStr.includes("lmstudio")
      ) {
        kind = "openai_compatible";
      } else if (candidateStr.includes("openai")) {
        kind = "openai";
      } else if (candidateStr.includes("gemini")) {
        kind = "gemini";
      } else if (service && typeof service === "string" && (service.startsWith("http://") || service.startsWith("https://"))) {
        if (service.includes("11434") || service.includes("ollama")) {
          kind = "ollama";
        } else if (service.includes("api.openai.com")) {
          kind = "openai";
        } else {
          kind = "openai_compatible";
        }
      }
    }

    // 2. Determine baseUrl
    let baseUrl: string | undefined = undefined;
    if ("baseUrl" in connection && typeof connection.baseUrl === "string" && connection.baseUrl) {
      baseUrl = connection.baseUrl;
    } else if (
      "service" in connection &&
      typeof connection.service === "string" &&
      (connection.service.startsWith("http://") || connection.service.startsWith("https://"))
    ) {
      baseUrl = connection.service;
    }

    // 3. Determine secretRef
    let secretRef = "";
    if ("auth" in connection && connection.auth) {
      if (connection.auth.mode === "secret_ref") {
        secretRef = connection.auth.secretRef;
      }
    } else if ("apiKeyEnvVar" in connection && typeof connection.apiKeyEnvVar === "string" && connection.apiKeyEnvVar) {
      secretRef = connection.apiKeyEnvVar;
    } else {
      secretRef = `${kind.toUpperCase()}_API_KEY`;
    }

    const apiKey = secretRef ? await resolver.resolveSecret(secretRef) : undefined;

    return {
      connectionId: connection.id,
      provider: kind,
      baseUrl,
      defaultModel: connection.defaultModel,
      apiKey,
    };
  }

  async testConnection(
    connection: ConnectionCredential | ProviderConnection,
    secretResolver?: SecretResolver
  ): Promise<ProviderHealth> {
    const config = await this.resolveConfig(connection, secretResolver);
    const provider = this.getProvider(config.provider);
    try {
      const rawRes = await provider.testConnection(config);
      const res = ProviderHealthSchema.parse(rawRes);
      if (res.message && config.apiKey && config.apiKey.length > 3) {
        res.message = res.message.split(config.apiKey).join("[REDACTED_SECRET]");
      }
      return res;
    } catch (err: unknown) {
      const sanitized = sanitizeProviderError(err, config.provider, [config.apiKey]);
      return {
        status: sanitized.code === "AUTHENTICATION_FAILED" ? "authentication_failed" : "unreachable",
        checkedAt: new Date().toISOString(),
        provider: config.provider,
        resolvedBaseUrl: config.baseUrl,
        message: sanitized.message,
      };
    }
  }

  async getCapabilities(
    connection: ConnectionCredential | ProviderConnection,
    secretResolver?: SecretResolver
  ): Promise<ProviderCapabilities> {
    const config = await this.resolveConfig(connection, secretResolver);
    const provider = this.getProvider(config.provider);
    const caps = await provider.getCapabilities(config);
    return ProviderCapabilitiesSchema.parse(caps);
  }

  async listModels(
    connection: ConnectionCredential | ProviderConnection,
    secretResolver?: SecretResolver
  ): Promise<ModelDescriptor[]> {
    const config = await this.resolveConfig(connection, secretResolver);
    const provider = this.getProvider(config.provider);
    try {
      const models = await provider.listModels(config);
      return z.array(ModelDescriptorSchema).parse(models);
    } catch (err: unknown) {
      throw sanitizeProviderError(err, config.provider, [config.apiKey]);
    }
  }

  async generate(
    connection: ConnectionCredential | ProviderConnection,
    request: LlmRequest,
    secretResolver?: SecretResolver
  ): Promise<LlmResponse> {
    // Enforcement: Zod validation on incoming request
    const validatedRequest = LlmRequestSchema.parse(request);

    const config = await this.resolveConfig(connection, secretResolver);
    const provider = this.getProvider(config.provider);

    try {
      const rawResponse = await provider.generate(config, validatedRequest);
      // Enforcement: Zod validation on outgoing response
      return LlmResponseSchema.parse(rawResponse);
    } catch (err: unknown) {
      throw sanitizeProviderError(err, config.provider, [config.apiKey]);
    }
  }
}

export const providerRegistry = new ProviderRegistry();
