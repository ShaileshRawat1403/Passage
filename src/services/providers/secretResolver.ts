export interface SecretResolver {
  resolveSecret(secretRef: string): Promise<string | undefined>;
}

export class EnvironmentSecretResolver implements SecretResolver {
  async resolveSecret(secretRef: string): Promise<string | undefined> {
    if (!secretRef) return undefined;

    // Direct environment variable match
    if (process.env[secretRef]) {
      return process.env[secretRef];
    }

    // Standardized fallback aliases
    const upperRef = secretRef.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (process.env[upperRef]) {
      return process.env[upperRef];
    }

    if (secretRef === "gemini_default" || secretRef === "GEMINI_API_KEY") {
      return process.env.GEMINI_API_KEY;
    }

    if (secretRef === "openai_default" || secretRef === "OPENAI_API_KEY") {
      return process.env.OPENAI_API_KEY;
    }

    return undefined;
  }
}
