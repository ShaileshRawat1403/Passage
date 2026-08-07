import { z } from "zod";

export type ProviderKind = "gemini" | "openai" | "openai_compatible" | "ollama";

export interface ProviderCapabilities {
  textGeneration: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  streaming: boolean;
  multimodalInput: boolean;
  modelDiscovery: boolean;
}

export const ProviderCapabilitiesSchema = z.object({
  textGeneration: z.boolean(),
  structuredOutput: z.boolean(),
  toolCalling: z.boolean(),
  streaming: z.boolean(),
  multimodalInput: z.boolean(),
  modelDiscovery: z.boolean(),
});

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const LlmMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export interface LlmRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?:
    | { type: "text" }
    | {
        type: "json";
        schema?: Record<string, unknown>;
      };
  timeoutMs?: number;
  metadata?: {
    requestId?: string;
    purpose?: string;
  };
}

export const LlmRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(LlmMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().positive().optional(),
  responseFormat: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("text") }),
      z.object({
        type: z.literal("json"),
        schema: z.record(z.string(), z.unknown()).optional(),
      }),
    ])
    .optional(),
  timeoutMs: z.number().positive().optional(),
  metadata: z
    .object({
      requestId: z.string().optional(),
      purpose: z.string().optional(),
    })
    .optional(),
});

export interface LlmResponse {
  requestId: string;
  providerId: string;
  modelRequested: string;
  modelResolved?: string;
  output: {
    text?: string;
    json?: unknown;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  finishReason?: "stop" | "length" | "tool_call" | "content_filter" | "unknown";
  evidence: {
    startedAt: string;
    completedAt: string;
    latencyMs: number;
    inputHash?: string;
    outputHash?: string;
  };
}

export const LlmResponseSchema = z.object({
  requestId: z.string(),
  providerId: z.string(),
  modelRequested: z.string(),
  modelResolved: z.string().optional(),
  output: z.object({
    text: z.string().optional(),
    json: z.unknown().optional(),
  }),
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
  finishReason: z
    .enum(["stop", "length", "tool_call", "content_filter", "unknown"])
    .optional(),
  evidence: z.object({
    startedAt: z.string(),
    completedAt: z.string(),
    latencyMs: z.number(),
    inputHash: z.string().optional(),
    outputHash: z.string().optional(),
  }),
});

export type ProviderHealthStatus =
  | "verified"
  | "authentication_failed"
  | "unreachable"
  | "misconfigured"
  | "unsupported";

export interface ProviderHealth {
  status: ProviderHealthStatus;
  checkedAt: string;
  latencyMs?: number;
  provider?: ProviderKind;
  resolvedBaseUrl?: string;
  message?: string;
}

export const ProviderHealthSchema = z.object({
  status: z.enum([
    "verified",
    "authentication_failed",
    "unreachable",
    "misconfigured",
    "unsupported",
  ]),
  checkedAt: z.string(),
  latencyMs: z.number().optional(),
  provider: z.enum(["gemini", "openai", "openai_compatible", "ollama"]).optional(),
  resolvedBaseUrl: z.string().optional(),
  message: z.string().optional(),
});

export interface ModelDescriptor {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
}

export const ModelDescriptorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextWindow: z.number().optional(),
});

export type ProviderErrorCode =
  | "AUTHENTICATION_FAILED"
  | "PROVIDER_UNREACHABLE"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "STRUCTURED_OUTPUT_INVALID"
  | "CAPABILITY_UNSUPPORTED"
  | "PROVIDER_ERROR";

export class ProviderError extends Error {
  code: ProviderErrorCode;
  provider: ProviderKind;
  retryable: boolean;
  statusCode?: number;

  constructor(options: {
    message: string;
    code: ProviderErrorCode;
    provider: ProviderKind;
    retryable?: boolean;
    statusCode?: number;
  }) {
    super(options.message);
    this.name = "ProviderError";
    this.code = options.code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;

    // Maintain standard stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderError);
    }
  }
}

export interface ProviderConnection {
  id: string;
  name: string;
  provider: ProviderKind;
  baseUrl?: string;
  defaultModel?: string;
  auth:
    | {
        mode: "secret_ref";
        secretRef: string;
      }
    | {
        mode: "none";
      };
  status: "configured" | "untested" | "verified" | "failed" | "unavailable";
  verifiedCapabilities?: ProviderCapabilities;
  lastTestedAt?: string;
}

export const ProviderConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["gemini", "openai", "openai_compatible", "ollama"]),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
  auth: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("secret_ref"),
      secretRef: z.string(),
    }),
    z.object({
      mode: z.literal("none"),
    }),
  ]),
  status: z.enum(["configured", "untested", "verified", "failed", "unavailable"]),
  verifiedCapabilities: ProviderCapabilitiesSchema.optional(),
  lastTestedAt: z.string().optional(),
});

export interface ResolvedProviderConfig {
  connectionId: string;
  provider: ProviderKind;
  baseUrl?: string;
  defaultModel?: string;
  apiKey?: string;
}
