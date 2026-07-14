import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from '../../../../src/main/domain/services/mapWithConcurrency';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('mapWithConcurrency', () => {
  it('preserves input order regardless of settle order', async () => {
    const items = [10, 30, 20, 5];
    const results = await mapWithConcurrency(
      items,
      async (item) => {
        await new Promise((resolve) => setTimeout(resolve, item));
        return item * 2;
      },
      { concurrency: 4 },
    );
    expect(results).toEqual([20, 60, 40, 10]);
  });

  it('never exceeds the concurrency cap', async () => {
    const total = 20;
    const concurrency = 3;
    const items = Array.from({ length: total }, (_, i) => i);

    let inFlight = 0;
    let maxObserved = 0;

    await mapWithConcurrency(
      items,
      async (item) => {
        inFlight += 1;
        maxObserved = Math.max(maxObserved, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return item;
      },
      { concurrency },
    );

    expect(maxObserved).toBeLessThanOrEqual(concurrency);
    expect(maxObserved).toBe(concurrency);
  });

  it('calls onProgress total times ending with (total, total)', async () => {
    const items = [1, 2, 3, 4, 5];
    const onProgress = vi.fn<[number, number], void>();

    await mapWithConcurrency(items, async (item) => item, {
      concurrency: 2,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(items.length);
    const calls = onProgress.mock.calls;
    expect(calls[calls.length - 1]).toEqual([items.length, items.length]);
    // done increments 1..total
    expect(calls.map((c) => c[0])).toEqual([1, 2, 3, 4, 5]);
    expect(calls.every((c) => c[1] === items.length)).toBe(true);
  });

  it('resolves to [] for an empty array without invoking worker', async () => {
    const worker = vi.fn<[number, number], Promise<number>>();
    const results = await mapWithConcurrency([], worker, { concurrency: 4 });
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it('fails fast when a worker rejects', async () => {
    const items = [1, 2, 3, 4];
    const boom = new Error('boom');

    await expect(
      mapWithConcurrency(
        items,
        async (item) => {
          if (item === 2) {
            throw boom;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
          return item;
        },
        { concurrency: 2 },
      ),
    ).rejects.toBe(boom);
  });

  it('stops scheduling new work after a fail-fast rejection', async () => {
    const total = 10;
    const items = Array.from({ length: total }, (_, i) => i);
    let started = 0;

    await expect(
      mapWithConcurrency(
        items,
        async (item) => {
          started += 1;
          if (item === 0) {
            throw new Error('fail-fast');
          }
          await new Promise((resolve) => setTimeout(resolve, 5));
          return item;
        },
        { concurrency: 2 },
      ),
    ).rejects.toThrow('fail-fast');

    expect(started).toBeLessThan(total);
  });

  it('rejects with the signal reason when aborted mid-flight and stops scheduling', async () => {
    const total = 10;
    const items = Array.from({ length: total }, (_, i) => i);
    const controller = new AbortController();
    const gates = items.map(() => deferred<void>());
    let started = 0;

    const run = mapWithConcurrency(
      items,
      async (item) => {
        started += 1;
        await gates[item].promise;
        return item;
      },
      { concurrency: 2, signal: controller.signal },
    );

    // Let the first batch start.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const reason = new Error('cancelled');
    controller.abort(reason);
    // Allow the in-flight workers to settle.
    gates.forEach((g) => g.resolve());

    await expect(run).rejects.toBe(reason);
    // Not all workers should have been scheduled.
    expect(started).toBeLessThan(total);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    const reason = new Error('pre-aborted');
    controller.abort(reason);
    const worker = vi.fn<[number, number], Promise<number>>();

    await expect(
      mapWithConcurrency([1, 2, 3], worker, {
        concurrency: 2,
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(worker).not.toHaveBeenCalled();
  });

  it('falls back to an AbortError-like exception when no reason is given', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      mapWithConcurrency([1, 2], async (item) => item, {
        concurrency: 1,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
