import { describe, it, expect, vi } from 'vitest';

import { withRetry } from '../../../src/main/shared/utils/retry';

const fastOptions = { baseMs: 1, maxMs: 2, factor: 2 } as const;

describe('withRetry', () => {
  it('succeeds on the first try and calls fn once', async () => {
    const fn = vi.fn(async () => 'ok');

    const result = await withRetry(fn, { retries: 3, ...fastOptions });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('retries then succeeds, calling fn N times', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error(`fail ${calls}`);
      }
      return 'done';
    });

    const result = await withRetry(fn, { retries: 5, ...fastOptions });

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('exhausts retries and throws the last error', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      throw new Error(`fail ${calls}`);
    });

    await expect(withRetry(fn, { retries: 2, ...fastOptions })).rejects.toThrow('fail 3');
    // retries + 1 = 3 total attempts
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops immediately when shouldRetry returns false', async () => {
    const fn = vi.fn(async () => {
      throw new Error('non-transient');
    });
    const shouldRetry = vi.fn(() => false);

    await expect(
      withRetry(fn, { retries: 5, ...fastOptions, shouldRetry }),
    ).rejects.toThrow('non-transient');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('calls onRetry with increasing attempt numbers', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 4) {
        throw new Error(`fail ${calls}`);
      }
      return 'done';
    });
    const onRetry = vi.fn();

    await withRetry(fn, { retries: 5, ...fastOptions, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(3);
    const attempts = onRetry.mock.calls.map((args) => args[1]);
    expect(attempts).toEqual([1, 2, 3]);
    // delays are capped at maxMs and grow exponentially: base=1, factor=2 -> 1, 2, 2(cap)
    const delays = onRetry.mock.calls.map((args) => args[2]);
    expect(delays).toEqual([1, 2, 2]);
  });

  it('aborts and rejects without further attempts', async () => {
    const controller = new AbortController();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      // Abort during the first attempt so the backoff wait is cancelled.
      controller.abort();
      throw new Error(`fail ${calls}`);
    });

    await expect(
      withRetry(fn, { retries: 5, baseMs: 1000, maxMs: 1000, signal: controller.signal }),
    ).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn(async () => 'ok');

    await expect(
      withRetry(fn, { retries: 3, ...fastOptions, signal: controller.signal }),
    ).rejects.toThrow();

    expect(fn).not.toHaveBeenCalled();
  });
});
