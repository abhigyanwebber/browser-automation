import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { CatalogEntry } from "./catalog.js";
import type { ModelAdapter, PlanInput } from "./base.js";
import type { TaskStep } from "../types.js";
import type { ProviderClient } from "../providers/types.js";

const PLAN_SYSTEM = `You are an expert browser automation planner.
You receive a detailed planning brief and must return ONLY valid JSON:
{"steps":[{"type":"goto"|"click"|"click_href"|"open_first_youtube"|"type"|"press_key"|"wait"|"extract_text"|"captcha_checkpoint", ...}]}

Follow the brief's decomposition, constraints, and step catalog exactly.
Produce clear, ordered steps a Playwright script can run without guessing.`;

const ENRICH_SYSTEM = `You assist a browser automation planner. Read the user command and return JSON only:
{
  "userGoal": "one sentence",
  "constraints": ["important limitation or requirement"],
  "suggestedSequence": ["step 1 idea", "step 2 idea", "..."]
}
Be concrete about sites, search terms, and which links to open.`;

export class RemoteModelAdapter implements ModelAdapter {
  constructor(
    readonly id: string,
    readonly capabilities: CatalogEntry["capabilities"],
    private readonly entry: CatalogEntry,
    private readonly client: ProviderClient
  ) {}

  async generatePlan(input: PlanInput): Promise<TaskStep[]> {
    const userContent =
      input.planningBrief ??
      `Task: ${input.command}\n${formatLegacyContext(input)}`;

    if (config.logPlannerIo) {
      writePlannerDebug(this.id, PLAN_SYSTEM, userContent);
    }

    const raw = await this.client.chat({
      model: this.entry.apiModelId,
      jsonMode: this.entry.provider !== "gemini",
      messages: [
        { role: "system", content: PLAN_SYSTEM },
        { role: "user", content: userContent }
      ]
    });

    if (config.logPlannerIo) {
      appendPlannerDebug(raw);
    }

    const parsed = JSON.parse(raw) as { steps?: TaskStep[] };
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error(`Model '${this.id}' returned invalid plan JSON`);
    }
    return parsed.steps;
  }

  async enrichContext(input: PlanInput): Promise<string> {
    const raw = await this.client.chat({
      model: this.entry.apiModelId,
      jsonMode: this.entry.provider !== "gemini",
      messages: [
        { role: "system", content: ENRICH_SYSTEM },
        { role: "user", content: input.command }
      ]
    });

    try {
      const structured = JSON.parse(raw) as {
        userGoal?: string;
        constraints?: string[];
        suggestedSequence?: string[];
      };
      const parts: string[] = [];
      if (structured.userGoal) {
        parts.push(`Goal: ${structured.userGoal}`);
      }
      if (structured.constraints?.length) {
        parts.push(`Constraints: ${structured.constraints.join("; ")}`);
      }
      if (structured.suggestedSequence?.length) {
        parts.push(
          `Suggested sequence: ${structured.suggestedSequence.join(" → ")}`
        );
      }
      if (parts.length > 0) {
        return parts.join("\n");
      }
    } catch {
      // fall back to raw text
    }

    return raw.trim();
  }
}

function formatLegacyContext(input: PlanInput): string {
  if (!input.context) {
    return "";
  }
  return `\nCollaboration context:\n${JSON.stringify(input.context, null, 2)}`;
}

function writePlannerDebug(
  modelId: string,
  system: string,
  user: string
): void {
  const file = path.join(config.dataDir, "planner-last-request.md");
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(
    file,
    `# Planner request (${modelId})\n\n## System\n\n${system}\n\n## User\n\n${user}\n`,
    "utf8"
  );
}

function appendPlannerDebug(response: string): void {
  const file = path.join(config.dataDir, "planner-last-request.md");
  fs.appendFileSync(file, `\n## Response\n\n\`\`\`json\n${response}\n\`\`\`\n`, "utf8");
}
