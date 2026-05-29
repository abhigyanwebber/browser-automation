import fs from "node:fs";
import path from "node:path";
import type { TaskRecord } from "./types.js";

export class TaskStorage {
  private readonly filePath: string;
  private tasks = new Map<string, TaskRecord>();

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, "tasks.json");
    this.loadFromDisk();
  }

  create(task: TaskRecord): TaskRecord {
    this.tasks.set(task.id, task);
    this.flush();
    return task;
  }

  get(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  list(): TaskRecord[] {
    return [...this.tasks.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  update(taskId: string, updater: (task: TaskRecord) => TaskRecord): TaskRecord {
    const current = this.tasks.get(taskId);
    if (!current) {
      throw new Error(`Task ${taskId} not found`);
    }

    const next = updater(current);
    this.tasks.set(taskId, next);
    this.flush();
    return next;
  }

  private loadFromDisk(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    if (!raw.trim()) {
      return;
    }

    const parsed = JSON.parse(raw) as TaskRecord[];
    for (const task of parsed) {
      this.tasks.set(task.id, task);
    }
  }

  private flush(): void {
    const serialized = JSON.stringify(this.list(), null, 2);
    fs.writeFileSync(this.filePath, serialized, "utf8");
  }
}
