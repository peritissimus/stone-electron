import { describe, expect, it, vi } from 'vitest';
import {
  WorkerManager,
  type ManagedWorker,
  type WorkerStatus,
} from '../../../src/main/infrastructure/workers/WorkerManager';

function fakeWorker(
  name: string,
  opts: { stop?: () => Promise<void>; state?: WorkerStatus['state'] } = {},
): ManagedWorker {
  return {
    name,
    status: () => ({ name, state: opts.state ?? 'ready' }),
    stop: opts.stop ?? (() => Promise.resolve()),
  };
}

describe('WorkerManager', () => {
  it('aggregates the status of every registered worker', async () => {
    const mgr = new WorkerManager();
    mgr.register(fakeWorker('jobs', { state: 'ready' }));
    mgr.register(fakeWorker('embeddings', { state: 'idle' }));

    const statuses = await mgr.statuses();
    expect(statuses.map((s) => [s.name, s.state])).toEqual([
      ['jobs', 'ready'],
      ['embeddings', 'idle'],
    ]);
  });

  it('stops every registered worker', async () => {
    const mgr = new WorkerManager();
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    mgr.register(fakeWorker('a', { stop: a }));
    mgr.register(fakeWorker('b', { stop: b }));

    await mgr.stopAll();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('isolates a failing stop — other workers still stop, no throw', async () => {
    const mgr = new WorkerManager();
    const good = vi.fn(async () => {});
    mgr.register(fakeWorker('bad', { stop: () => Promise.reject(new Error('boom')) }));
    mgr.register(fakeWorker('good', { stop: good }));

    await expect(mgr.stopAll()).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledOnce();
  });

  it('bounds a hung stop by the grace timeout and still stops the others', async () => {
    const mgr = new WorkerManager();
    const good = vi.fn(async () => {});
    mgr.register(fakeWorker('hung', { stop: () => new Promise<void>(() => {}) })); // never resolves
    mgr.register(fakeWorker('good', { stop: good }));

    const start = Date.now();
    await mgr.stopAll(50);
    expect(Date.now() - start).toBeLessThan(2_000); // didn't hang on the stuck worker
    expect(good).toHaveBeenCalledOnce();
  });
});
