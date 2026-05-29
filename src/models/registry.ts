import { createProviderRegistry, getProviderClient } from "../providers/index.js";
import type { ProviderClient } from "../providers/types.js";
import { modelCatalog } from "./catalog.js";
import type { ModelAdapter } from "./base.js";
import { DummyModelAdapter } from "./dummyModel.js";
import { RemoteModelAdapter } from "./remoteAdapter.js";
import { VisionDummyModelAdapter } from "./visionDummyModel.js";

export interface ModelRegistryBundle {
  adapters: Map<string, ModelAdapter>;
  providers: Map<string, ProviderClient>;
}

export function createModelRegistry(): ModelRegistryBundle {
  const providers = createProviderRegistry();
  const adapters = new Map<string, ModelAdapter>();

  adapters.set("dummy", new DummyModelAdapter());
  adapters.set("vision-dummy", new VisionDummyModelAdapter());

  for (const entry of modelCatalog) {
    if (entry.id === "dummy" || entry.id === "vision-dummy") {
      continue;
    }

    const client = getProviderClient(providers, entry.provider);
    if (!client) {
      continue;
    }

    adapters.set(
      entry.id,
      new RemoteModelAdapter(entry.id, entry.capabilities, entry, client)
    );
  }

  return { adapters, providers };
}
