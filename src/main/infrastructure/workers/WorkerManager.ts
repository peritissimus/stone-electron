/**
 * WorkerManager — one place to observe and shut down the app's resident
 * background engines (the job queue, the embedding worker thread, the live
 * whisper server). They share an *operational* shape — long-lived, with a
 * lifecycle and a resource cost — even though their *purposes* differ, so this
 * unifies the management, not the execution.
 *
 * Note: start is intentionally NOT part of the contract — each engine's start
 * trigger is its own (the job runner starts at boot, the whisper server starts
 * when a recording begins, the embedding worker lazy-loads on first use). What
 * they genuinely share is coordinated shutdown and status reporting (and, later,
 * cross-worker resource policy — e.g. easing off during a recording).
 */

import { logger } from '../../shared/utils';

export type WorkerState = 'idle' | 'starting' | 'ready' | 'degraded' | 'error' | 'stopped';

export interface WorkerStatus {
  name: string;
  state: WorkerState;
  /** Human-readable extra context (e.g. last error, pinned language). */
  detail?: string;
  /** Numeric gauges for a status panel (queue depth, in-flight, restarts…). */
  metrics?: Record<string, number>;
}

/** A resident background engine the WorkerManager can observe and stop. */
export interface ManagedWorker {
  readonly name: string;
  status(): WorkerStatus | Promise<WorkerStatus>;
  stop(): Promise<void>;
}

export class WorkerManager {
  private readonly workers: ManagedWorker[] = [];

  register(worker: ManagedWorker): void {
    this.workers.push(worker);
  }

  /** Snapshot of every worker's state — feeds a status panel / IPC. */
  async statuses(): Promise<WorkerStatus[]> {
    return Promise.all(this.workers.map((w) => Promise.resolve(w.status())));
  }

  /** Stop every worker, each bounded by `graceMs` so one hung stop can't block
   *  shutdown. Errors are logged, never thrown. */
  async stopAll(graceMs = 5_000): Promise<void> {
    await Promise.all(
      this.workers.map(async (w) => {
        try {
          await withTimeout(Promise.resolve(w.stop()), graceMs);
        } catch (err) {
          logger.warn(`[WorkerManager] '${w.name}' did not stop cleanly within ${graceMs}ms:`, err);
        }
      }),
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
