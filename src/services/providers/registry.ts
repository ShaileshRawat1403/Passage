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
  ProviderCapabilities,
  ModelDescriptor,
  LlmRequest,
  LlmResponse,
  ProviderError,
  ProviderConnection,
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

    // Determine provider kind
    if ("provider" in connection && connection.provider) {
      kind = connection.provider;
    } else if ("service" in connection) {
      const s = connection.service;
      if (s === "openai") kind = "openai";
      else if (s === "gemini") kind = "gemini";
      else if (s === "custom_http" || (s as string) === "openai_compatible") kind = "openai_compatible";
      else if ((s as string) === "ollama") kind = "ollama";
      else kind = "gemini";
    }

    let secretRef = "";
    if ("auth" in connection && connection.auth) {
      if (connection.auth.mode === "secret_ref") {
        secretRef = connection.auth.secretRef;
      }
    } else if ("apiKeyEnvVar" in connection && typeof connection.apiKeyEnvVar === "string") {
      secretRef = connection.apiKeyEnvVar;
    } else {
      secretRef = `${kind.toUpperCase()}_API_KEY`;
    }

    const apiKey = secretRef ? await resolver.resolveSecret(secretRef) : undefined;
    const baseUrl = "baseUrl" in connection ? connection.baseUrl : undefined;

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
    return await provider.testConnection(config);
  }

  async getCapabilities(
    connection: ConnectionCredential | ProviderConnection,
    secretResolver?: SecretResolver
  ): Promise<ProviderCapabilities> {
    const config = await this.resolveConfig(connection, secretResolver);
    const provider = this.getProvider(config.provider);
    return await provider.getCapabilities(config);
  }

  async listModels(
    connection: ConnectionCredential | ProviderConnection,
    secretResolver?: SecretResolver
  ): Promise<ModelDescriptor[]> {
    const config = await this.resolveConfig(connection, secretResolver);
    const provider = this.getProvider(config.provider);
    return await provider.listModels(config);
  }

  async generate(
    connection: ConnectionCredential | ProviderConnection,
    request: LlmRequest,
    secretResolver?: SecretResolver
  ): Promise<LlmResponse> {
    const config = await this.resolveConfig(connection, secretResolver);
    const provider = this.getProvider(config.provider);
    return await provider.generate(config, request);
  }
}

export const providerRegistry = new ProviderRegistry();
