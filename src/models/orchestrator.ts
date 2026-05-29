import type { TaskStep } from "../types.js";
import type { ModelAdapter } from "./base.js";
import { HybridRouter } from "./hybridRouter.js";
import { modelCatalog } from "./catalog.js";
import { ModelCoordinator } from "./coordinator.js";
import type { HybridRoutingResult, RoutingDecision } from "./routingTypes.js";
import { config } from "../config.js";
import { createProviderRegistry, getProviderClient } from "../providers/index.js";

export interface OrchestrationResult {
  steps: TaskStep[];
  trace: string[];
  routing: HybridRoutingResult;
}

export class ModelOrchestrator {
  private readonly hybridRouter: HybridRouter;
  private readonly coordinator: ModelCoordinator;

  constructor(private readonly models: Map<string, ModelAdapter>) {
    const providers = createProviderRegistry();
    const gemini = getProviderClient(providers, "gemini");

    this.hybridRouter = new HybridRouter(modelCatalog, this.models, {
      orchestratorClient: gemini,
      orchestratorModelId: config.orchestratorModelId,
      useGeminiOrchestrator: config.useGeminiOrchestrator
    });
    this.coordinator = new ModelCoordinator(this.models);
  }

  async buildCollaborativePlan(
    command: string,
    preferredPlannerId?: string
  ): Promise<OrchestrationResult> {
    const trace: string[] = [];
    const routing = await this.hybridRouter.route(command, preferredPlannerId);

    trace.push(
      `Pipeline: rules -> presets -> ${routing.usedOrchestrator ? `Gemini orchestrator (${routing.orchestratorModel})` : "presets only"}`
    );
    if (routing.orchestratorNote) {
      trace.push(routing.orchestratorNote);
    }
    trace.push(`Rule confidence=${routing.ruleAnalysis.confidence.toFixed(2)}`);
    for (const reason of routing.ruleAnalysis.reasons) {
      trace.push(`Signal: ${reason}`);
    }
    for (const decision of routing.decisions) {
      trace.push(formatDecision(decision));
    }

    const { context, trace: contextTrace } =
      await this.coordinator.buildCollaborationContext(command, routing.decisions);
    trace.push(...contextTrace);

    const triedPlanners: string[] = [];
    let decisions = routing.decisions;
    let steps: TaskStep[] = [];

    while (true) {
      const plannerId = decisions.find((d) => d.role === "planner")?.modelId;
      if (!plannerId) {
        throw new Error("No planner in routing decisions");
      }

      try {
        const plan = await this.coordinator.generatePlan(
          plannerId,
          command,
          context,
          routing
        );
        steps = plan.steps;
        trace.push(...plan.trace);
        break;
      } catch (error) {
        triedPlanners.push(plannerId);
        const fallback = this.hybridRouter.pickFallbackPlanner(triedPlanners);
        if (!fallback) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        trace.push(`Planner '${plannerId}' failed (${message}); fallback -> '${fallback.id}'`);
        decisions = [
          ...decisions.filter((d) => d.role !== "planner"),
          {
            role: "planner",
            modelId: fallback.id,
            method: "fallback",
            confidence: 0.5,
            reason: "Primary planner failed; retrying (no extra helper API calls)"
          }
        ];
      }
    }

    trace.push("Agent broker: cooperative plan ready for browser runner");
    return { steps, trace, routing };
  }
}

function formatDecision(decision: RoutingDecision): string {
  const provider = decision.provider ? ` @ ${decision.provider}` : "";
  return (
    `[${decision.role}] ${decision.modelId}${provider} via ${decision.method} ` +
    `(confidence ${decision.confidence.toFixed(2)}): ${decision.reason}`
  );
}
