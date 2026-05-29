export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_for_human"
  | "completed"
  | "failed";

export type TaskStepType =
  | "goto"
  | "click"
  | "click_href"
  | "vision_click"
  | "open_first_youtube"
  | "type"
  | "press_key"
  | "wait"
  | "extract_text"
  | "captcha_checkpoint";

export interface TaskStep {
  type: TaskStepType;
  selector?: string;
  value?: string;
  url?: string;
  timeoutMs?: number;
}

export interface TaskRecord {
  id: string;
  command: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  logs: string[];
  steps: TaskStep[];
  currentStepIndex: number;
  result?: string;
  error?: string;
}
