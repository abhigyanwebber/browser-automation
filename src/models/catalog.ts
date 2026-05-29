import type { ModelCapability } from "./base.js";
import type { ApiProvider } from "../providers/types.js";
import type { ModelProfile } from "./routingTypes.js";

export interface CatalogEntry extends ModelProfile {
  provider: ApiProvider;
  apiModelId: string;
  strengths: string[];
  weaknesses: string[];
}

/** Curated models across Gemini, DeepSeek, Groq, and OpenRouter */
export const modelCatalog: CatalogEntry[] = [
  {
    id: "gemini-flash",
    provider: "gemini",
    apiModelId: "gemini-2.0-flash",
    capabilities: ["planning", "reasoning", "vision", "writing"],
    costTier: 1,
    latencyTier: 1,
    priority: 90,
    strengths: ["fast", "multimodal", "generalist"],
    weaknesses: ["weaker on very long documents"]
  },
  {
    id: "gemini-pro",
    provider: "gemini",
    apiModelId: "gemini-1.5-pro",
    capabilities: ["planning", "reasoning", "vision"],
    costTier: 2,
    latencyTier: 2,
    priority: 70,
    strengths: ["strong vision", "long context"],
    weaknesses: ["slower", "higher cost"]
  },
  {
    id: "deepseek-chat",
    provider: "deepseek",
    apiModelId: "deepseek-chat",
    capabilities: ["planning", "reasoning", "writing"],
    costTier: 1,
    latencyTier: 2,
    priority: 85,
    strengths: ["cheap reasoning", "good structured output"],
    weaknesses: ["no native vision"]
  },
  {
    id: "deepseek-reasoner",
    provider: "deepseek",
    apiModelId: "deepseek-reasoner",
    capabilities: ["reasoning", "planning"],
    costTier: 2,
    latencyTier: 3,
    priority: 75,
    strengths: ["deep multi-step reasoning"],
    weaknesses: ["slower", "no vision"]
  },
  {
    id: "groq-llama-70b",
    provider: "groq",
    apiModelId: "llama-3.3-70b-versatile",
    capabilities: ["planning", "reasoning", "writing"],
    costTier: 1,
    latencyTier: 1,
    priority: 88,
    strengths: ["very fast", "good for action plans"],
    weaknesses: ["no vision", "shorter context"]
  },
  {
    id: "groq-llama-8b",
    provider: "groq",
    apiModelId: "llama-3.1-8b-instant",
    capabilities: ["planning", "writing"],
    costTier: 1,
    latencyTier: 1,
    priority: 60,
    strengths: ["ultra fast", "cheap"],
    weaknesses: ["less accurate on complex tasks"]
  },
  {
    id: "openrouter-claude-haiku",
    provider: "openrouter",
    apiModelId: "anthropic/claude-3.5-haiku",
    capabilities: ["writing", "reasoning", "planning"],
    costTier: 2,
    latencyTier: 1,
    priority: 82,
    strengths: ["excellent writing tone", "clear instructions"],
    weaknesses: ["no vision via this route"]
  },
  {
    id: "openrouter-gpt-4o-mini",
    provider: "openrouter",
    apiModelId: "openai/gpt-4o-mini",
    capabilities: ["planning", "writing", "reasoning"],
    costTier: 2,
    latencyTier: 1,
    priority: 80,
    strengths: ["balanced generalist", "reliable JSON"],
    weaknesses: ["no vision here"]
  },
  {
    id: "openrouter-llama-vision",
    provider: "openrouter",
    apiModelId: "meta-llama/llama-3.2-90b-vision-instruct",
    capabilities: ["vision", "reasoning"],
    costTier: 2,
    latencyTier: 2,
    priority: 78,
    strengths: ["vision via OpenRouter", "screenshot understanding"],
    weaknesses: ["slower than Groq", "not ideal for long writing"]
  },
  {
    id: "dummy",
    provider: "gemini",
    apiModelId: "dummy",
    capabilities: ["planning", "reasoning", "writing"],
    costTier: 1,
    latencyTier: 1,
    priority: 5,
    strengths: ["offline fallback"],
    weaknesses: ["not a real LLM"]
  },
  {
    id: "vision-dummy",
    provider: "gemini",
    apiModelId: "dummy",
    capabilities: ["vision"],
    costTier: 1,
    latencyTier: 1,
    priority: 5,
    strengths: ["offline fallback"],
    weaknesses: ["not a real LLM"]
  }
];

export function getCatalogEntry(modelId: string): CatalogEntry | undefined {
  return modelCatalog.find((m) => m.id === modelId);
}

export function listAvailableCatalog(
  adapters: Map<string, unknown>
): CatalogEntry[] {
  return modelCatalog.filter((entry) => adapters.has(entry.id));
}

export function catalogForCapability(
  capability: ModelCapability,
  adapters: Map<string, unknown>
): CatalogEntry[] {
  return listAvailableCatalog(adapters).filter((e) =>
    e.capabilities.includes(capability)
  );
}
