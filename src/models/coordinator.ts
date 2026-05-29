import type { CollaborationContext, ModelAdapter, PlanInput } from "./base.js";
import { getCatalogEntry } from "./catalog.js";
import { buildPlanningBrief } from "./planningBrief.js";
import type { HybridRoutingResult, RoutingDecision } from "./routingTypes.js";
import type { TaskStep } from "../types.js";
import { isRateLimitError } from "../providers/errors.js";

export interface CoordinationResult {
  steps: TaskStep[];
  trace: string[];
  context: CollaborationContext;
}

export interface CollaborationContextResult {
  context: CollaborationContext;
  trace: string[];
}

export class ModelCoordinator {
  constructor(private readonly adapters: Map<string, ModelAdapter>) {}

  /** Runs reasoner + vision once per task (avoids duplicate API calls on planner retry) */
  async buildCollaborationContext(
    command: string,
    decisions: RoutingDecision[]
  ): Promise<CollaborationContextResult> {
    const trace: string[] = [];
    const context: CollaborationContext = {};
    const input: PlanInput = { command, context };

    const visionId = decisions.find((d) => d.role === "vision")?.modelId;
    const reasonerId = decisions.find((d) => d.role === "reasoner")?.modelId;
    const writerId = decisions.find((d) => d.role === "writer")?.modelId;

    if (reasonerId) {
      try {
        const reasoner = this.get(reasonerId);
        if (reasoner.enrichContext) {
          context.reasonerNotes = await reasoner.enrichContext(input);
          trace.push(
            `Reasoner '${reasonerId}' (${getCatalogEntry(reasonerId)?.provider}) supplied logic notes`
          );
        }
      } catch (error) {
        trace.push(formatHelperFailure("Reasoner", reasonerId, error));
      }
    }

    if (visionId) {
      try {
        const vision = this.get(visionId);
        if (vision.enrichContext) {
          context.visionSummary = await vision.enrichContext(input);
          trace.push(
            `Vision '${visionId}' (${getCatalogEntry(visionId)?.provider}) supplied visual context`
          );
        } else {
          context.visionSummary =
            "Vision model assigned; will analyze screenshots at captcha/visual checkpoints.";
          trace.push(`Vision '${visionId}' queued for screenshot checkpoints`);
        }
      } catch (error) {
        trace.push(formatHelperFailure("Vision", visionId, error));
      }
    }

    if (writerId) {
      context.writerHints =
        "Writer model will polish user-facing text after browser actions complete.";
      trace.push(`Writer '${writerId}' assigned for final text polish`);
    }

    return { context, trace };
  }

  async generatePlan(
    plannerId: string,
    command: string,
    context: CollaborationContext,
    routing?: HybridRoutingResult
  ): Promise<{ steps: TaskStep[]; trace: string[] }> {
    const planningBrief = buildPlanningBrief({
      command,
      collaboration: context,
      routing
    });

    const planner = this.get(plannerId);
    const steps = await planner.generatePlan({
      command,
      context,
      planningBrief
    });
    return {
      steps,
      trace: [
        `Planner '${plannerId}' (${getCatalogEntry(plannerId)?.provider}) received enriched brief (${planningBrief.length} chars)`,
        `Planner '${plannerId}' generated ${steps.length} step(s)`
      ]
    };
  }

  async runCollaborativePlan(
    command: string,
    decisions: RoutingDecision[]
  ): Promise<CoordinationResult> {
    const plannerId = decisions.find((d) => d.role === "planner")?.modelId;
    if (!plannerId) {
      throw new Error("No planner assigned");
    }

    const { context, trace: contextTrace } =
      await this.buildCollaborationContext(command, decisions);
    const { steps, trace: planTrace } = await this.generatePlan(
      plannerId,
      command,
      context
    );

    return {
      steps,
      trace: [...contextTrace, ...planTrace],
      context
    };
  }

  private get(modelId: string): ModelAdapter {
    const adapter = this.adapters.get(modelId);
    if (!adapter) {
      throw new Error(`Unknown model '${modelId}'`);
    }
    return adapter;
  }
}

function formatHelperFailure(
  role: string,
  modelId: string,
  error: unknown
): string {
  const message = error instanceof Error ? error.message : String(error);
  if (isRateLimitError(error)) {
    return `${role} '${modelId}' rate limited (${Math.ceil(error.retryAfterMs / 1000)}s cooldown); continuing without it`;
  }
  return `${role} '${modelId}' failed (${message}); continuing without it`;
}
