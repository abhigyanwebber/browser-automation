import { getCatalogEntry, listAvailableCatalog } from "./catalog.js";
import type { CatalogEntry } from "./catalog.js";
import type { ProviderClient } from "../providers/types.js";
import type {
  RuleAnalysis,
  RoutingDecision
} from "./routingTypes.js";
import type { ModelAdapter } from "./base.js";

export interface OrchestratorInput {
  command: string;
  ruleAnalysis: RuleAnalysis;
  suggestedDecisions: RoutingDecision[];
  adapters: Map<string, ModelAdapter>;
}

export interface OrchestratorResult {
  decisions: RoutingDecision[];
  reasoning: string;
}

export class GeminiFlashOrchestrator {
  constructor(
    private readonly client: ProviderClient,
    private readonly orchestratorModelId: string
  ) {}

  async finalize(input: OrchestratorInput): Promise<OrchestratorResult> {
    const catalog = listAvailableCatalog(input.adapters).filter(
      (e) => e.id !== "dummy" && e.id !== "vision-dummy"
    );

    const raw = await this.client.chat({
      model: this.orchestratorModelId,
      jsonMode: true,
      messages: [
        {
          role: "system",
          content:
            "You are the orchestrator for a multi-model browser agent. " +
            "Pick the best team from the catalog. Each model has strengths/weaknesses — " +
            "cover gaps (e.g. no-vision models need a vision helper). " +
            "Return JSON: { plannerId, visionId?, writerId?, reasonerId?, reasoning, keptPresets?: string[] }. " +
            "Prefer rule presets when they already fit; override only when ambiguous or mismatched."
        },
        {
          role: "user",
          content: JSON.stringify({
            command: input.command,
            ruleSignals: input.ruleAnalysis.signals,
            ruleConfidence: input.ruleAnalysis.confidence,
            suggestedTeam: input.suggestedDecisions,
            catalog: catalog.map(formatCatalogEntry)
          })
        }
      ]
    });

    const parsed = JSON.parse(raw) as {
      plannerId: string;
      visionId?: string;
      writerId?: string;
      reasonerId?: string;
      reasoning?: string;
      keptPresets?: string[];
    };

    const decisions: RoutingDecision[] = [
      this.toDecision("planner", parsed.plannerId, parsed.reasoning, input)
    ];

    if (parsed.visionId) {
      decisions.push(
        this.toDecision(
          "vision",
          parsed.visionId,
          "Vision specialist covers planner weakness on images/screenshots",
          input
        )
      );
    }
    if (parsed.writerId) {
      decisions.push(
        this.toDecision(
          "writer",
          parsed.writerId,
          "Writer specialist handles polished text output",
          input
        )
      );
    }
    if (parsed.reasonerId) {
      decisions.push(
        this.toDecision(
          "reasoner",
          parsed.reasonerId,
          "Reasoner handles complex multi-step logic",
          input
        )
      );
    }

    return {
      decisions,
      reasoning: parsed.reasoning ?? "Gemini Flash orchestrator selection"
    };
  }

  private toDecision(
    role: RoutingDecision["role"],
    modelId: string,
    reason: string | undefined,
    input: OrchestratorInput
  ): RoutingDecision {
    const entry = getCatalogEntry(modelId);
    const wasPreset = input.suggestedDecisions.some(
      (s) => s.role === role && s.modelId === modelId
    );

    return {
      role,
      modelId,
      provider: entry?.provider,
      method: wasPreset ? "preset" : "orchestrator",
      confidence: input.ruleAnalysis.confidence,
      reason: `Gemini Flash: ${reason ?? "selected for role"}`
    };
  }
}

function formatCatalogEntry(entry: CatalogEntry) {
  return {
    id: entry.id,
    provider: entry.provider,
    capabilities: entry.capabilities,
    strengths: entry.strengths,
    weaknesses: entry.weaknesses,
    costTier: entry.costTier,
    latencyTier: entry.latencyTier
  };
}

/** Accept rule presets when Gemini API is unavailable */
export function acceptSuggestedTeam(
  suggested: RoutingDecision[],
  reasoning: string
): OrchestratorResult {
  return {
    decisions: suggested.map((d) => ({
      ...d,
      method: d.method === "rule" ? "preset" : d.method,
      reason: `Preset path (no orchestrator API): ${d.reason}`
    })),
    reasoning
  };
}
