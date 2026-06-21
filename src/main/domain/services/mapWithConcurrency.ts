/**
 * In-process concurrency primitive: `mapWithConcurrency`.
 *
 * Maps over a list of items by running an async `worker` for each, while
 * keeping at most `concurrency` workers in flight at any moment. Results are
 * returned in INPUT order (result[i] always corresponds to items[i]),
 * regardless of the order in which individual workers settle.
 *
 * FAIL-FAST CONTRACT:
 * If any worker rejects, the whole call rejects with that error and no new
 * work is scheduled. Workers that are already in flight are allowed to settle
 * (their results/rejections are ignored). There is no per-item error
 * isolation: callers who want to keep going despite individual failures must
 * try/catch inside their own `worker` and return a sentinel/Result value.
 *
 * CANCELLATION:
 * If an `AbortSignal` is supplied and becomes aborted, scheduling of new work
 * stops and the call rejects with the signal's `reason` (or an AbortError-like
 * DOMException when no reason is present). In-flight workers settle but their
 * outcomes are ignored.
 *
 * This module is pure: it imports nothing and performs no I/O or logging.
 */

export interface MapWithConcurrencyOptions {
  concurrency: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

function createAbortError(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) {
    return signal.reason;
  }
  return new DOMException('The operation was aborted.', 'AbortError');
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: MapWithConcurrencyOptions,
): Promise<R[]> {
  const total = items.length;
  if (total === 0) {
    return [];
  }

  const { signal, onProgress } = options;
  const concurrency = Math.max(1, Math.min(options.concurrency, total));

  const results = new Array<R>(total);
  let nextIndex = 0;
  let done = 0;

  return new Promise<R[]>((resolve, reject) => {
    let settled = false;
    let active = 0;

    const finish = (fn: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    const maybeComplete = (): void => {
      if (!settled && active === 0 && nextIndex >= total) {
        finish(() => resolve(results));
      }
    };

    const schedule = (): void => {
      while (!settled && active < concurrency && nextIndex < total) {
        if (signal?.aborted) {
          finish(() => reject(createAbortError(signal)));
          return;
        }

        const index = nextIndex;
        nextIndex += 1;
        active += 1;

        worker(items[index], index).then(
          (value) => {
            active -= 1;
            if (settled) {
              return;
            }
            results[index] = value;
            done += 1;
            onProgress?.(done, total);
            schedule();
            maybeComplete();
          },
          (error: unknown) => {
            active -= 1;
            finish(() => reject(error));
          },
        );
      }

      maybeComplete();
    };

    if (signal?.aborted) {
      finish(() => reject(createAbortError(signal)));
      return;
    }

    schedule();
  });
}
