import type { ModelCapability } from "./base.js";
import type { CommandSignals } from "./routingTypes.js";

/**
 * Best default specialist per capability when rules are confident.
 * Orchestrator (Gemini Flash) can override these on ambiguous tasks.
 */
export const capabilityPresets: Record<ModelCapability, string> = {
  planning: "groq-llama-70b",
  reasoning: "deepseek-reasoner",
  writing: "openrouter-claude-haiku",
  /** OpenRouter vision avoids Gemini quota issues on free tier */
  vision: "openrouter-llama-vision"
};

export function pickPresetForSignals(
  signals: CommandSignals
): Partial<Record<"planner" | "vision" | "writer" | "reasoner", string>> {
  const picks: Partial<Record<"planner" | "vision" | "writer" | "reasoner", string>> =
    {};

  picks.planner = capabilityPresets.planning;

  if (signals.vision >= 0.25) {
    picks.vision = capabilityPresets.vision;
  }
  if (signals.writing >= 0.25) {
    picks.writer = capabilityPresets.writing;
  }
  if (signals.planning < 0.35 && signals.planning + signals.writing < signals.vision) {
    picks.planner = capabilityPresets.planning;
  }

  return picks;
}
