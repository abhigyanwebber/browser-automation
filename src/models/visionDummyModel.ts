import type { ModelAdapter, ModelCapability, PlanInput } from "./base.js";
import type { TaskStep } from "../types.js";

export class VisionDummyModelAdapter implements ModelAdapter {
  id = "vision-dummy";
  capabilities: ModelCapability[] = ["vision"];

  async generatePlan(_input: PlanInput): Promise<TaskStep[]> {
    return [];
  }

  async enrichContext(input: PlanInput): Promise<string> {
    return (
      `Vision dummy: task may involve screenshots or captcha. Command: ${input.command}`
    );
  }
}
