import type { ModelAdapter, ModelCapability } from "./base.js";
import {
  acceptSuggestedTeam,
  GeminiFlashOrchestrator
} from "./geminiOrchestrator.js";
import { getProviderClient } from "../providers/index.js";
import type { ProviderClient } from "../providers/types.js";
import { getCatalogEntry, modelCatalog } from "./catalog.js";
import { analyzeCommand, routeByPresets } from "./ruleRouter.js";
import type {
  HybridRoutingResult,
  ModelProfile,
  RoutingDecision
} from "./routingTypes.js";
import { config } from "../config.js";
import { isRateLimitError } from "../providers/errors.js";
import { getProviderRateLimiter } from "../providers/rateLimiter.js";

export interface HybridRouterOptions {
  orchestratorClient?: ProviderClient;
  orchestratorModelId: string;
  useGeminiOrchestrator: boolean;
}

export class HybridRouter {
  private readonly orchestrator?: GeminiFlashOrchestrator;

  constructor(
    private readonly profiles: ModelProfile[],
    private readonly adapters: Map<string, ModelAdapter>,
    options: HybridRouterOptions
  ) {
    if (
      options.useGeminiOrchestrator &&
      options.orchestratorClient?.isConfigured()
    ) {
      this.orchestrator = new GeminiFlashOrchestrator(
        options.orchestratorClient,
        options.orchestratorModelId
      );
    }
  }

  async route(
    command: string,
    preferredPlannerId?: string
  ): Promise<HybridRoutingResult> {
    const ruleAnalysis = analyzeCommand(command);

    if (preferredPlannerId) {
      this.assertCapability(preferredPlannerId, "planning");
      const suggested: RoutingDecision[] = [
        {
          role: "planner",
          modelId: preferredPlannerId,
          provider: getCatalogEntry(preferredPlannerId)?.provider,
          method: "user_override",
          confidence: 1,
          reason: `User requested planner '${preferredPlannerId}'`
        }
      ];
      const helpers = routeByPresets(ruleAnalysis, this.profiles, this.adapters);
      for (const helper of helpers) {
        if (helper.role !== "planner") {
          suggested.push(helper);
        }
      }
      return this.finalizeWithOrchestrator(command, ruleAnalysis, suggested);
    }

    const suggested = routeByPresets(ruleAnalysis, this.profiles, this.adapters);
    for (const d of suggested) {
      d.reason = `Rule path: ${d.reason}`;
    }

    return this.finalizeWithOrchestrator(command, ruleAnalysis, suggested);
  }

  private async finalizeWithOrchestrator(
    command: string,
    ruleAnalysis: ReturnType<typeof analyzeCommand>,
    suggested: RoutingDecision[]
  ): Promise<HybridRoutingResult> {
    let decisions = suggested;
    let usedOrchestrator = false;
    const orchestratorModel = config.orchestratorModelId;

    let orchestratorNote: string | undefined;

    const geminiGate = getProviderRateLimiter("gemini").check();

    if (this.orchestrator && !geminiGate.ok) {
      orchestratorNote = `Skipping Gemini orchestrator: ${geminiGate.reason}`;
      const accepted = acceptSuggestedTeam(suggested, orchestratorNote);
      decisions = accepted.decisions;
    } else if (this.orchestrator) {
      try {
        usedOrchestrator = true;
        const result = await this.orchestrator.finalize({
          command,
          ruleAnalysis,
          suggestedDecisions: suggested,
          adapters: this.adapters
        });
        decisions = result.decisions;
        for (const d of decisions) {
          if (!d.reason.includes("Gemini Flash")) {
            d.reason = `After presets — ${d.reason}`;
          }
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          orchestratorNote = `Orchestrator rate limited; using presets. Retry in ${Math.ceil(error.retryAfterMs / 1000)}s`;
        } else {
          const message = error instanceof Error ? error.message : String(error);
          orchestratorNote = `Orchestrator failed; using rule presets. ${message}`;
        }
        const accepted = acceptSuggestedTeam(suggested, orchestratorNote);
        decisions = accepted.decisions;
        usedOrchestrator = false;
      }
    } else {
      orchestratorNote = "Gemini orchestrator unavailable; using rule presets only";
      const accepted = acceptSuggestedTeam(suggested, orchestratorNote);
      decisions = accepted.decisions;
    }

    this.validateDecisions(decisions);
    return {
      decisions,
      ruleAnalysis,
      usedOrchestrator,
      orchestratorModel,
      orchestratorNote
    };
  }

  pickFallbackPlanner(excludeIds: string[]): ModelAdapter | undefined {
    const excluded = new Set(excludeIds);
    const candidates = modelCatalog
      .filter(
        (p) =>
          p.capabilities.includes("planning") &&
          !excluded.has(p.id) &&
          this.adapters.has(p.id)
      )
      .sort((a, b) => {
        if (a.costTier !== b.costTier) return a.costTier - b.costTier;
        if (a.latencyTier !== b.latencyTier) return a.latencyTier - b.latencyTier;
        return b.priority - a.priority;
      });

    const next = candidates[0];
    return next ? this.adapters.get(next.id) : undefined;
  }

  getAdapter(modelId: string): ModelAdapter {
    const adapter = this.adapters.get(modelId);
    if (!adapter) {
      throw new Error(`Unknown model '${modelId}'`);
    }
    return adapter;
  }

  private assertCapability(modelId: string, capability: ModelCapability): void {
    const profile = this.profiles.find((p) => p.id === modelId);
    if (!profile) {
      throw new Error(`Unknown model '${modelId}'`);
    }
    if (!profile.capabilities.includes(capability)) {
      throw new Error(`Model '${modelId}' does not support '${capability}'`);
    }
  }

  private validateDecisions(decisions: RoutingDecision[]): void {
    const planner = decisions.find((d) => d.role === "planner");
    if (!planner) {
      throw new Error("Routing produced no planner");
    }
    for (const decision of decisions) {
      if (!this.adapters.has(decision.modelId)) {
        throw new Error(`Routed to unknown model '${decision.modelId}'`);
      }
    }
  }
}
