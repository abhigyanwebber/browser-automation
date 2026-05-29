import { getCatalogEntry } from "./catalog.js";
import type { ModelAdapter } from "./base.js";
import type { ModelCapability } from "./base.js";
import { capabilityPresets, pickPresetForSignals } from "./rulePresets.js";
import type { CommandSignals, ModelProfile, RuleAnalysis, RoutingDecision } from "./routingTypes.js";

const VISION_KEYWORDS = [
  "image",
  "screenshot",
  "photo",
  "visual",
  "picture",
  "screen",
  "see",
  "look at",
  "ocr",
  "captcha"
];

const WRITING_KEYWORDS = [
  "write",
  "draft",
  "compose",
  "email",
  "message",
  "summarize",
  "summary",
  "report",
  "caption",
  "reply"
];

const PLANNING_KEYWORDS = [
  "login",
  "log in",
  "sign in",
  "navigate",
  "open",
  "click",
  "fill",
  "submit",
  "search",
  "go to",
  "download",
  "upload",
  "book",
  "order",
  "checkout"
];

export function analyzeCommand(command: string): RuleAnalysis {
  const normalized = command.toLowerCase();
  const reasons: string[] = [];

  const vision = scoreKeywords(normalized, VISION_KEYWORDS, reasons, "vision");
  const writing = scoreKeywords(normalized, WRITING_KEYWORDS, reasons, "writing");
  const planning = scoreKeywords(normalized, PLANNING_KEYWORDS, reasons, "planning");

  const signals: CommandSignals = { planning, vision, writing };
  const maxSignal = Math.max(planning, vision, writing);
  const sum = planning + vision + writing;

  let confidence: number;
  if (sum === 0) {
    confidence = 0.35;
    reasons.push("No strong keyword signals — ambiguous command");
  } else if (maxSignal >= 0.6 && isDominant(signals, maxSignal)) {
    confidence = 0.9;
    reasons.push("Clear dominant capability signal from keywords");
  } else if (maxSignal >= 0.35) {
    confidence = 0.72;
    reasons.push("Moderate keyword signals — mostly clear");
  } else {
    confidence = 0.55;
    reasons.push("Weak or mixed keyword signals — borderline");
  }

  if (normalized.length < 12) {
    confidence = Math.min(confidence, 0.5);
    reasons.push("Very short command lowers routing confidence");
  }

  return { signals, confidence, reasons };
}

/** Rule path: use curated best-model presets per capability */
export function routeByPresets(
  analysis: RuleAnalysis,
  profiles: ModelProfile[],
  adapters: Map<string, ModelAdapter>
): RoutingDecision[] {
  const decisions: RoutingDecision[] = [];
  const { signals } = analysis;
  const picks = pickPresetForSignals(signals);

  if (picks.planner) {
    decisions.push(
      presetDecision(
        "planner",
        picks.planner,
        "planning",
        analysis,
        profiles,
        adapters,
        signals.planning
      )
    );
  }

  if (picks.vision) {
    decisions.push(
      presetDecision(
        "vision",
        picks.vision,
        "vision",
        analysis,
        profiles,
        adapters,
        signals.vision
      )
    );
  }

  if (picks.writer) {
    const plannerId = decisions.find((d) => d.role === "planner")?.modelId;
    const writerId = resolvePresetModel(
      picks.writer,
      "writing",
      profiles,
      adapters
    );
    if (writerId !== plannerId) {
      decisions.push(
        presetDecision(
          "writer",
          picks.writer,
          "writing",
          analysis,
          profiles,
          adapters,
          signals.writing
        )
      );
    }
  }

  if (signals.planning >= 0.5 && signals.planning + signals.writing > 0.8) {
    const reasonerId = resolvePresetModel(
      capabilityPresets.reasoning,
      "reasoning",
      profiles,
      adapters
    );
    if (!decisions.some((d) => d.modelId === reasonerId)) {
      decisions.push(
        presetDecision(
          "reasoner",
          capabilityPresets.reasoning,
          "reasoning",
          analysis,
          profiles,
          adapters,
          signals.planning
        )
      );
    }
  }

  return decisions;
}

function presetDecision(
  role: RoutingDecision["role"],
  presetId: string,
  capability: ModelCapability,
  analysis: RuleAnalysis,
  profiles: ModelProfile[],
  adapters: Map<string, ModelAdapter>,
  signal: number
): RoutingDecision {
  const modelId = resolvePresetModel(presetId, capability, profiles, adapters);
  const entry = getCatalogEntry(modelId);
  return {
    role,
    modelId,
    provider: entry?.provider,
    method: "preset",
    confidence: analysis.confidence,
    reason: `Rule preset '${presetId}' for ${role} (signal ${signal.toFixed(2)})`
  };
}

function resolvePresetModel(
  presetId: string,
  capability: ModelCapability,
  profiles: ModelProfile[],
  adapters: Map<string, ModelAdapter>
): string {
  if (adapters.has(presetId)) {
    return presetId;
  }
  return pickBest(profiles, capability, adapters).id;
}

function scoreKeywords(
  text: string,
  keywords: string[],
  reasons: string[],
  label: string
): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      hits += 1;
    }
  }
  if (hits > 0) {
    reasons.push(`${label}: matched ${hits} keyword(s)`);
  }
  const score = Math.min(1, hits * 0.35);
  return score;
}

function isDominant(signals: CommandSignals, max: number): boolean {
  const values = [signals.planning, signals.vision, signals.writing];
  const topCount = values.filter((v) => v === max && v > 0).length;
  return topCount === 1;
}

function pickBest(
  profiles: ModelProfile[],
  capability: ModelCapability,
  adapters: Map<string, ModelAdapter>
): ModelProfile {
  const candidates = profiles.filter(
    (p) => p.capabilities.includes(capability) && adapters.has(p.id)
  );
  if (candidates.length === 0) {
    throw new Error(`No registered model with capability '${capability}'`);
  }

  candidates.sort((a, b) => {
    if (a.costTier !== b.costTier) return a.costTier - b.costTier;
    if (a.latencyTier !== b.latencyTier) return a.latencyTier - b.latencyTier;
    return b.priority - a.priority;
  });

  return candidates[0];
}
