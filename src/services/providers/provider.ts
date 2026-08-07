import {
  ProviderKind,
  ResolvedProviderConfig,
  ProviderHealth,
  ProviderCapabilities,
  ModelDescriptor,
  LlmRequest,
  LlmResponse,
} from "../../domain/providers";

export interface LlmProvider {
  readonly kind: ProviderKind;

  testConnection(config: ResolvedProviderConfig): Promise<ProviderHealth>;

  getCapabilities(config: ResolvedProviderConfig): Promise<ProviderCapabilities>;

  listModels(config: ResolvedProviderConfig): Promise<ModelDescriptor[]>;

  generate(config: ResolvedProviderConfig, request: LlmRequest): Promise<LlmResponse>;
}
