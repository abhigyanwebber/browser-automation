import type { ModelCapability } from "./base.js";
import type { ApiProvider } from "../providers/types.js";

export type RoutingMethod =
  | "rule"
  | "preset"
  | "orchestrator"
  | "user_override"
  | "fallback";

export interface RoutingDecision {
  role: "planner" | "vision" | "writer" | "reasoner";
  modelId: string;
  provider?: ApiProvider;
  method: RoutingMethod;
  confidence: number;
  reason: string;
}

export interface CommandSignals {
  planning: number;
  vision: number;
  writing: number;
}

export interface RuleAnalysis {
  signals: CommandSignals;
  confidence: number;
  reasons: string[];
}

export interface HybridRoutingResult {
  decisions: RoutingDecision[];
  ruleAnalysis: RuleAnalysis;
  usedOrchestrator: boolean;
  orchestratorModel?: string;
  orchestratorNote?: string;
}

export interface ModelProfile {
  id: string;
  provider?: ApiProvider;
  apiModelId?: string;
  capabilities: ModelCapability[];
  strengths?: string[];
  weaknesses?: string[];
  /** 1 = cheap, 3 = expensive */
  costTier: 1 | 2 | 3;
  /** 1 = fast, 3 = slow */
  latencyTier: 1 | 2 | 3;
  /** Higher wins when cost/latency are equal */
  priority: number;
}
