import { config } from "../config.js";
import { GeminiClient } from "./gemini.js";
import { OpenAiCompatibleClient } from "./openaiCompatible.js";
import type { ApiProvider, ProviderClient } from "./types.js";

export function createProviderRegistry(): Map<ApiProvider, ProviderClient> {
  const registry = new Map<ApiProvider, ProviderClient>();

  registry.set(
    "gemini",
    new GeminiClient(config.geminiApiKey ?? "")
  );
  registry.set(
    "deepseek",
    new OpenAiCompatibleClient(
      "deepseek",
      config.deepseekApiKey ?? "",
      "https://api.deepseek.com/v1"
    )
  );
  registry.set(
    "groq",
    new OpenAiCompatibleClient(
      "groq",
      config.groqApiKey ?? "",
      "https://api.groq.com/openai/v1"
    )
  );
  registry.set(
    "openrouter",
    new OpenAiCompatibleClient(
      "openrouter",
      config.openrouterApiKey ?? "",
      "https://openrouter.ai/api/v1",
      {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "ai-browser-agent"
      }
    )
  );

  return registry;
}

export function getProviderClient(
  registry: Map<ApiProvider, ProviderClient>,
  provider: ApiProvider
): ProviderClient | undefined {
  const client = registry.get(provider);
  return client?.isConfigured() ? client : undefined;
}
