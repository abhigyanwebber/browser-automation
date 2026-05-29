import { randomUUID } from "node:crypto";
import { sanitizePlan } from "./browser/planSanitizer.js";
import type { BrowserSessionManager } from "./browser/session.js";
import { config } from "./config.js";
import type { ModelAdapter } from "./models/base.js";
import { ModelOrchestrator } from "./models/orchestrator.js";
import { getProfile, modelProfiles } from "./models/profiles.js";
import type { TaskRecord } from "./types.js";
import { TaskStorage } from "./storage.js";

type ResumeReason = "captcha_solved";

export class TaskRunner {
  private running = new Set<string>();
  private readonly orchestrator: ModelOrchestrator;

  constructor(
    private readonly storage: TaskStorage,
    private readonly browser: BrowserSessionManager,
    private readonly models: Map<string, ModelAdapter>
  ) {
    this.orchestrator = new ModelOrchestrator(this.models);
  }

  async createTask(command: string, requestedModel?: string): Promise<TaskRecord> {
    const orchestration = await this.orchestrator.buildCollaborativePlan(
      command,
      requestedModel
    );
    const now = new Date().toISOString();

    const task: TaskRecord = {
      id: randomUUID(),
      command,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      logs: [...orchestration.trace],
      steps: sanitizePlan(orchestration.steps, command),
      currentStepIndex: 0
    };

    this.storage.create(task);
    void this.run(task.id);
    return task;
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.storage.get(taskId);
  }

  listTasks(): TaskRecord[] {
    return this.storage.list();
  }

  listModels(): Array<{
    id: string;
    capabilities: string[];
    provider?: string;
    apiModelId?: string;
    strengths?: string[];
    weaknesses?: string[];
    costTier?: number;
    latencyTier?: number;
    priority?: number;
  }> {
    return [...this.models.values()].map((model) => {
      const profile = getProfile(model.id);
      return {
        id: model.id,
        capabilities: [...model.capabilities],
        provider: profile?.provider,
        apiModelId: profile?.apiModelId,
        strengths: profile?.strengths,
        weaknesses: profile?.weaknesses,
        costTier: profile?.costTier,
        latencyTier: profile?.latencyTier,
        priority: profile?.priority
      };
    });
  }

  listModelProfiles() {
    return modelProfiles;
  }

  async resumeTask(taskId: string, reason: ResumeReason): Promise<TaskRecord> {
    const task = this.storage.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    if (task.status !== "waiting_for_human") {
      throw new Error("Task is not waiting for human");
    }

    this.storage.update(taskId, (existing) => ({
      ...existing,
      status: "queued",
      updatedAt: new Date().toISOString(),
      logs: [...existing.logs, `Resumed by user (${reason})`]
    }));

    void this.run(taskId);
    return this.mustGet(taskId);
  }

  private async run(taskId: string): Promise<void> {
    if (this.running.has(taskId)) {
      return;
    }
    this.running.add(taskId);

    try {
      await this.browser.init();
      this.update(taskId, (task) => ({
        ...task,
        status: "running",
        updatedAt: new Date().toISOString()
      }));

      while (true) {
        const task = this.mustGet(taskId);
        if (task.currentStepIndex >= task.steps.length) {
          this.update(taskId, (done) => ({
            ...done,
            status: "completed",
            updatedAt: new Date().toISOString(),
            logs: [...done.logs, "Task completed"]
          }));
          break;
        }

        const step = task.steps[task.currentStepIndex];
        if (step.type === "captcha_checkpoint") {
          this.update(taskId, (waiting) => ({
            ...waiting,
            status: "waiting_for_human",
            updatedAt: new Date().toISOString(),
            logs: [
              ...waiting.logs,
              `Step ${waiting.currentStepIndex}: captcha/manual checkpoint`
            ]
          }));
          break;
        }

        const output = await this.browser.executeStep(
          task.id,
          task.currentStepIndex,
          step
        );

        this.update(taskId, (next) => ({
          ...next,
          currentStepIndex: next.currentStepIndex + 1,
          updatedAt: new Date().toISOString(),
          result: output ?? next.result,
          logs: [
            ...next.logs,
            `Step ${next.currentStepIndex}: ${step.type}${output ? ` -> ${output}` : ""}`
          ]
        }));

        if (await this.browser.isCaptchaVisible()) {
          this.update(taskId, (waiting) => ({
            ...waiting,
            status: "waiting_for_human",
            updatedAt: new Date().toISOString(),
            logs: [
              ...waiting.logs,
              "Captcha detected — solve it in the browser, then resume the task"
            ]
          }));
          break;
        }

        await this.browser.pauseBetweenSteps(config.stepDelayMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.update(taskId, (failed) => ({
        ...failed,
        status: "failed",
        updatedAt: new Date().toISOString(),
        error: message,
        logs: [...failed.logs, `Failed: ${message}`]
      }));
    } finally {
      this.running.delete(taskId);
    }
  }

  private update(
    taskId: string,
    updater: (task: TaskRecord) => TaskRecord
  ): TaskRecord {
    return this.storage.update(taskId, updater);
  }

  private mustGet(taskId: string): TaskRecord {
    const task = this.storage.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    return task;
  }
}
