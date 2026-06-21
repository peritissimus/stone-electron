/**
 * IJobQueue — outbound port for enqueuing durable background jobs.
 *
 * Producers (use cases) depend on this to hand work off to the background
 * runner without knowing about the infrastructure that executes it. The
 * concrete implementation (the JobRunner) persists the job and wakes the
 * worker loop so it's picked up promptly.
 */

export interface EnqueueJobOptions {
  maxAttempts?: number;
  /** Delay before the job first becomes eligible to run. */
  delayMs?: number;
}

export interface IJobQueue {
  /** Persist a job of `type` with an opaque `payload`; resolves to the job id. */
  enqueue(type: string, payload?: unknown, options?: EnqueueJobOptions): Promise<string>;
}
