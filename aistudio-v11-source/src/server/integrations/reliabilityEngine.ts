import { IntegrationError, IntegrationResponse } from "./IntegrationAdapter";

export interface ReliabilityPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export const DEFAULT_RELIABILITY_POLICY: ReliabilityPolicy = {
  maxRetries: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  timeoutMs: 5000,
};

// Server-side in-memory cache of completed idempotency operations
const idempotencyStore = new Map<string, { result: IntegrationResponse; timestamp: number }>();

export class ReliabilityEngine {
  /**
   * Check if an idempotent operation has already succeeded
   */
  public static checkIdempotency(idempotencyKey: string): IntegrationResponse | null {
    if (!idempotencyKey) return null;
    const entry = idempotencyStore.get(idempotencyKey);
    if (!entry) return null;
    return entry.result;
  }

  /**
   * Record a completed idempotent operation
   */
  public static recordIdempotency(idempotencyKey: string, result: IntegrationResponse): void {
    if (!idempotencyKey) return;
    idempotencyStore.set(idempotencyKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clears in-memory idempotency store (useful for testing)
   */
  public static clearIdempotency(): void {
    idempotencyStore.clear();
  }

  /**
   * Executes an asynchronous task bounded by a strict timeout
   */
  public static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    providerCode: string,
    correlationId: string
  ): Promise<T> {
    let timer: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new IntegrationError(
            `Integration request to provider ${providerCode} timed out after ${timeoutMs}ms.`,
            "INTEGRATION_TIMEOUT",
            providerCode,
            correlationId,
            504,
            true
          )
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /**
   * Executes an operation with bounded exponential backoff retries for transient errors
   */
  public static async withRetry<T>(
    operation: (attempt: number) => Promise<T>,
    providerCode: string,
    correlationId: string,
    policy: Partial<ReliabilityPolicy> = {}
  ): Promise<{ result: T; attempts: number }> {
    const p: ReliabilityPolicy = { ...DEFAULT_RELIABILITY_POLICY, ...policy };
    let attempt = 0;
    let currentDelay = p.initialDelayMs;

    while (true) {
      attempt++;
      try {
        const result = await this.withTimeout(
          () => operation(attempt),
          p.timeoutMs,
          providerCode,
          correlationId
        );
        return { result, attempts: attempt };
      } catch (err: any) {
        const isRetryable = err instanceof IntegrationError ? err.retryable : false;

        if (!isRetryable || attempt >= p.maxRetries) {
          throw err;
        }

        // Bounded exponential delay with jitter
        const jitter = Math.random() * 50;
        await new Promise((resolve) => setTimeout(resolve, currentDelay + jitter));
        currentDelay = Math.min(currentDelay * p.backoffMultiplier, p.maxDelayMs);
      }
    }
  }
}
