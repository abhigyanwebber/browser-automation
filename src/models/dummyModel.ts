import type { ModelAdapter, PlanInput } from "./base.js";
import type { TaskStep } from "../types.js";
import type { ModelCapability } from "./base.js";

export class DummyModelAdapter implements ModelAdapter {
  id = "dummy";
  capabilities: ModelCapability[] = ["planning", "reasoning", "writing"];

  async generatePlan(input: PlanInput): Promise<TaskStep[]> {
    const prompt = input.command.toLowerCase();
    const hasContext =
      input.context?.visionSummary ||
      input.context?.reasonerNotes ||
      input.context?.writerHints;

    if (prompt.includes("open") && prompt.includes("google")) {
      const steps: TaskStep[] = [
        { type: "goto", url: "https://www.google.com" }
      ];
      if (prompt.includes("search")) {
        const query = prompt.includes("weather") ? "weather" : "search";
        steps.push(
          { type: "type", selector: 'textarea[name="q"]', value: query },
          {
            type: "press_key",
            value: "Enter",
            selector: 'textarea[name="q"]'
          },
          { type: "wait", timeoutMs: 2000 }
        );
      }
      steps.push({
        type: "captcha_checkpoint",
        value: "If captcha appears, solve it."
      });
      return steps;
    }

    const steps = [
      { type: "goto", url: "https://example.com" },
      {
        type: "captcha_checkpoint",
        value: "Check page manually and solve captcha if shown."
      },
      { type: "extract_text", selector: "h1" }
    ] as TaskStep[];

    if (hasContext) {
      steps.unshift({
        type: "wait",
        timeoutMs: 500,
        value: "Team context received from specialist models"
      });
    }

    return steps;
  }
}
