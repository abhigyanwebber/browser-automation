import express, { type Request, type Response } from "express";
import { z } from "zod";
import type { TaskRunner } from "./taskRunner.js";

const createTaskSchema = z.object({
  command: z.string().min(1),
  model: z.string().optional()
});

const resumeSchema = z.object({
  reason: z.literal("captcha_solved")
});

export function createServer(taskRunner: TaskRunner) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post("/tasks", async (req: Request, res: Response) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      const task = await taskRunner.createTask(parsed.data.command, parsed.data.model);
      return res.status(201).json(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  });

  app.get("/tasks", (_req: Request, res: Response) => {
    res.json(taskRunner.listTasks());
  });

  app.get("/models", (_req: Request, res: Response) => {
    res.json({
      models: taskRunner.listModels(),
      profiles: taskRunner.listModelProfiles()
    });
  });

  app.get("/tasks/:id", (req: Request<{ id: string }>, res: Response) => {
    const task = taskRunner.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    return res.json(task);
  });

  app.post(
    "/tasks/:id/resume",
    async (req: Request<{ id: string }>, res: Response) => {
    const parsed = resumeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      const task = await taskRunner.resumeTask(req.params.id, parsed.data.reason);
      return res.json(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
    }
  );

  return app;
}
