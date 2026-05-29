import { RateLimitExceededError } from "./errors.js";
import {
  getProviderRateLimiter,
  parseRetryAfterMs
} from "./rateLimiter.js";
import type { ChatRequest, ProviderClient } from "./types.js";

export class GeminiClient implements ProviderClient {
  readonly provider = "gemini" as const;
  private readonly limiter = getProviderRateLimiter("gemini");

  constructor(private readonly apiKey: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey.trim());
  }

  async chat(request: ChatRequest): Promise<string> {
    const gate = this.limiter.check();
    if (!gate.ok) {
      throw new RateLimitExceededError(
        "gemini",
        gate.retryAfterMs ?? 60_000,
        gate.reason ?? "Gemini rate limit reached"
      );
    }

    this.limiter.recordRequest();

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: request.temperature ?? 0,
          ...(request.jsonMode ? { responseMimeType: "application/json" } : {})
        },
        contents: buildGeminiContents(request)
      })
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(text) ?? 60_000;
        this.limiter.recordRateLimitHit(retryAfterMs);
        throw new RateLimitExceededError(
          "gemini",
          retryAfterMs,
          `Gemini quota/rate limit (429). Retry after ${Math.ceil(retryAfterMs / 1000)}s`
        );
      }
      throw new Error(`gemini API error (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("gemini API returned empty content");
    }
    return content;
  }
}

function buildGeminiContents(request: ChatRequest) {
  const textParts = request.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  if (!request.imageBase64) {
    return textParts;
  }

  const prompt =
    request.messages.find((m) => m.role === "user")?.content ??
    request.messages.at(-1)?.content ??
    "";

  return [
    {
      role: "user",
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: request.imageMimeType ?? "image/png",
            data: request.imageBase64
          }
        }
      ]
    }
  ];
}
