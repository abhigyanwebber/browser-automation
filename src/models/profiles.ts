import { getCatalogEntry, modelCatalog } from "./catalog.js";

export const modelProfiles = modelCatalog;

export function getProfile(modelId: string) {
  return getCatalogEntry(modelId);
}
