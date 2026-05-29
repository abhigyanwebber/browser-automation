import type { ApiProvider, ChatRequest, ProviderClient } from "./types.js";

export class OpenAiCompatibleClient implements ProviderClient {
  constructor(
    readonly provider: ApiProvider,
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly extraHeaders: Record<string, string> = {}
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey.trim());
  }

  async chat(request: ChatRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature ?? 0,
        messages: buildOpenAiMessages(request),
        ...(request.jsonMode ? { response_format: { type: "json_object" } } : {})
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${this.provider} API error (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${this.provider} API returned empty content`);
    }
    return content;
  }
}

function buildOpenAiMessages(request: ChatRequest) {
  if (!request.imageBase64) {
    return request.messages;
  }

  const mime = request.imageMimeType ?? "image/png";
  const dataUrl = `data:${mime};base64,${request.imageBase64}`;
  const system = request.messages.find((m) => m.role === "system");
  const userText =
    request.messages.find((m) => m.role === "user")?.content ??
    request.messages.at(-1)?.content ??
    "";

  const built: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }> = [];

  if (system) {
    built.push({ role: "system", content: system.content });
  }

  built.push({
    role: "user",
    content: [
      { type: "text", text: userText },
      { type: "image_url", image_url: { url: dataUrl } }
    ]
  });

  return built;
}
