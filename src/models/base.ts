import type { TaskStep } from "../types.js";

export type ModelCapability = "planning" | "reasoning" | "writing" | "vision";

export interface CollaborationContext {
  visionSummary?: string;
  reasonerNotes?: string;
  writerHints?: string;
}

export interface PlanInput {
  command: string;
  context?: CollaborationContext;
  /** Polished multi-section brief for the planner */
  planningBrief?: string;
}

export interface ModelAdapter {
  id: string;
  capabilities: ModelCapability[];
  generatePlan(input: PlanInput): Promise<TaskStep[]>;
  /** Optional: vision/reasoner models enrich context for the planner */
  enrichContext?(input: PlanInput): Promise<string>;
}
