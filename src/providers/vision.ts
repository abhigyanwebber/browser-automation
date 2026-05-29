import { getCatalogEntry } from "../models/catalog.js";
import { config } from "../config.js";
import { createProviderRegistry, getProviderClient } from "./index.js";
import type { ProviderClient } from "./types.js";

export interface VisionModelBinding {
  client: ProviderClient;
  modelId: string;
  catalogId: string;
}

/** Pick first available vision-capable model */
export function resolveVisionModel(): VisionModelBinding | null {
  if (!config.useVisionClick) {
    return null;
  }

  const registry = createProviderRegistry();
  const order = ["gemini-flash", "openrouter-llama-vision", "gemini-pro"];

  for (const catalogId of order) {
    const entry = getCatalogEntry(catalogId);
    if (!entry || !entry.capabilities.includes("vision")) {
      continue;
    }
    const client = getProviderClient(registry, entry.provider);
    if (!client) {
      continue;
    }
    return { client, modelId: entry.apiModelId, catalogId };
  }

  return null;
}
