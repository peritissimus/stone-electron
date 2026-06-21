/**
 * Retry-with-backoff primitive.
 *
 * Provides `withRetry`, a small, dependency-free helper that re-invokes an
 * async function on failure using deterministic exponential backoff (no
 * jitter). It supports caller-controlled retry predicates, per-retry
 * notifications, and cooperative cancellation via an AbortSignal.
 *
 * This module is pure: it imports nothing and performs no I/O beyond the
 * timer used to wait between attempts. It is intended to be reused across
 * adapters and use cases that talk to flaky external systems.
 */

export interface RetryOptions {
  /** Number of retries after the initial attempt. Total attempts = retries + 1. */
  retries: number;
  /** Base delay in milliseconds for the first backoff. Defaults to 500. */
  baseMs?: number;
  /** Maximum delay in milliseconds (cap). Defaults to 30000. */
  maxMs?: number;
  /** Exponential growth factor. Defaults to 2. */
  factor?: number;
  /** Optional signal to cancel pending/backoff waits and stop retrying. */
  signal?: AbortSignal;
  /**
   * Predicate deciding whether a given error is retryable. Receives the error
   * and the 1-based attempt number that just failed. Defaults to always-true.
   * Returning false rethrows the error immediately.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /**
   * Called before each backoff wait with the error that triggered the retry,
   * the 1-based attempt number that failed, and the delay about to be waited.
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError(signal as AbortSignal));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Invokes `fn` with deterministic exponential backoff retries.
 *
 * @param fn Async operation; receives the 1-based attempt number.
 * @param options Retry configuration.
 * @returns The resolved value of the first successful attempt.
 * @throws The last error if all attempts fail, or the abort reason if cancelled.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    retries,
    baseMs = 500,
    maxMs = 30000,
    factor = 2,
    signal,
    shouldRetry = (): boolean => true,
    onRetry,
  } = options;

  const totalAttempts = retries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw abortError(signal);
    }

    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt >= totalAttempts;
      if (isLastAttempt || !shouldRetry(error, attempt)) {
        throw error;
      }

      const retryIndex = attempt - 1;
      const delayMs = Math.min(baseMs * factor ** retryIndex, maxMs);

      onRetry?.(error, attempt, delayMs);

      await delay(delayMs, signal);
    }
  }

  // Unreachable in practice (loop either returns or throws), but satisfies the
  // type system for the case where retries is negative.
  throw lastError;
}
