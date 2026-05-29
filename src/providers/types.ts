export type ApiProvider = "gemini" | "deepseek" | "groq" | "openrouter";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  /** PNG/JPEG screenshot as base64 (no data: prefix) */
  imageBase64?: string;
  imageMimeType?: "image/png" | "image/jpeg";
}

export interface ProviderClient {
  provider: ApiProvider;
  isConfigured(): boolean;
  chat(request: ChatRequest): Promise<string>;
}
