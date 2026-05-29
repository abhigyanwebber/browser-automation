export class RateLimitExceededError extends Error {
  readonly name = "RateLimitExceededError";

  constructor(
    readonly provider: string,
    readonly retryAfterMs: number,
    message: string
  ) {
    super(message);
  }
}

export function isRateLimitError(error: unknown): error is RateLimitExceededError {
  return error instanceof RateLimitExceededError;
}

export function isRateLimitMessage(message: string): boolean {
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("quota") ||
    message.includes("rate limit")
  );
}
