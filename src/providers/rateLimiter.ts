import { config } from "../config.js";

export interface RateLimitCheck {
  ok: boolean;
  reason?: string;
  retryAfterMs?: number;
}

/** Sliding-window limiter + cooldown after 429 */
export class ProviderRateLimiter {
  private readonly requestTimestamps: number[] = [];
  private cooldownUntil = 0;

  constructor(
    private readonly providerName: string,
    private readonly maxRequestsPerMinute: number,
    private readonly defaultCooldownMs: number
  ) {}

  check(): RateLimitCheck {
    const now = Date.now();

    if (now < this.cooldownUntil) {
      const retryAfterMs = this.cooldownUntil - now;
      return {
        ok: false,
        retryAfterMs,
        reason: `${this.providerName} in cooldown for ${Math.ceil(retryAfterMs / 1000)}s (quota/rate limit)`
      };
    }

    this.pruneOldRequests(now);
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldest = this.requestTimestamps[0] ?? now;
      const retryAfterMs = Math.max(1000, 60_000 - (now - oldest));
      return {
        ok: false,
        retryAfterMs,
        reason: `${this.providerName} local limit: ${this.maxRequestsPerMinute}/min reached`
      };
    }

    return { ok: true };
  }

  recordRequest(): void {
    this.pruneOldRequests(Date.now());
    this.requestTimestamps.push(Date.now());
  }

  recordRateLimitHit(retryAfterMs?: number): void {
    const cooldown = retryAfterMs ?? this.defaultCooldownMs;
    this.cooldownUntil = Date.now() + cooldown;
  }

  private pruneOldRequests(now: number): void {
    const windowStart = now - 60_000;
    while (
      this.requestTimestamps.length > 0 &&
      this.requestTimestamps[0] < windowStart
    ) {
      this.requestTimestamps.shift();
    }
  }
}

const limiters = new Map<string, ProviderRateLimiter>();

export function getProviderRateLimiter(provider: string): ProviderRateLimiter {
  let limiter = limiters.get(provider);
  if (!limiter) {
    const maxPerMinute =
      provider === "gemini"
        ? config.geminiMaxRequestsPerMinute
        : 60;
    const cooldownMs =
      provider === "gemini" ? config.geminiCooldownMs : 30_000;
    limiter = new ProviderRateLimiter(provider, maxPerMinute, cooldownMs);
    limiters.set(provider, limiter);
  }
  return limiter;
}

/** Parse retry delay from Gemini/OpenAI-style error JSON text */
export function parseRetryAfterMs(errorText: string): number | undefined {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: { details?: Array<{ retryDelay?: string }> };
    };
    const retryDelay = parsed.error?.details?.find(
      (d) => d.retryDelay
    )?.retryDelay;
    if (retryDelay) {
      const seconds = Number.parseFloat(retryDelay.replace(/s$/, ""));
      if (!Number.isNaN(seconds)) {
        return Math.ceil(seconds * 1000);
      }
    }
  } catch {
    // ignore parse errors
  }

  const match = errorText.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) {
    return Math.ceil(Number.parseFloat(match[1]) * 1000);
  }

  return undefined;
}
