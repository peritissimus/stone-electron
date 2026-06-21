/**
 * JobRunner — the driver for the durable background-job queue.
 *
 * Polls the IJobRepository for due work, runs the registered handler for each
 * job's type, and persists the outcome. Designed to be a polite tenant on a
 * user's laptop — it must never busy-loop, pile up unbounded work, or retry a
 * poison job forever. Concretely:
 *
 *   • Adaptive idle backoff — when there's no work the poll interval doubles up
 *     to `maxIdleMs`, so an idle app isn't hammering the DB on a tight loop. It
 *     resets to `minIdleMs` (and is woken immediately) the moment work appears.
 *   • Concurrency cap — at most `maxConcurrency` handlers run at once; the
 *     runner only claims as many jobs as it has free slots.
 *   • Per-job timeout — a handler that hangs is aborted after `jobTimeoutMs`
 *     so it can't pin a slot indefinitely.
 *   • Bounded retries — failures back off exponentially and, once attempts are
 *     exhausted, the job is marked `dead` (dead-letter) and left alone.
 *   • Crash recovery — jobs orphaned in `running` by a previous crash are
 *     re-queued on startup (counted as an attempt, so they still die if toxic).
 *   • Retention prune — terminal rows are swept on an interval so the table
 *     never grows without bound.
 *   • Graceful stop — on shutdown the loop halts and in-flight work is given a
 *     short grace period; anything still running is recovered next launch.
 */

import type {
  BackoffPolicy,
  EnqueueJobOptions,
  IJobQueue,
  IJobRepository,
  IJobTracer,
  IIdGenerator,
} from '../../domain';
import { JobEntity } from '../../domain';
import { logger } from '../../shared/utils';

export interface JobContext {
  /** Aborts when the per-job timeout fires or the runner is stopping. */
  signal: AbortSignal;
  /** 1-based attempt number for this execution. */
  attempt: number;
  jobId: string;
}

export type JobHandler = (payload: unknown, ctx: JobContext) => Promise<void>;

export interface JobRunnerConfig {
  maxConcurrency?: number;
  minIdleMs?: number;
  maxIdleMs?: number;
  jobTimeoutMs?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  /** A `running` job older than this is considered crash-orphaned. */
  staleAfterMs?: number;
  /** Terminal rows older than this are pruned. */
  retentionMs?: number;
  pruneIntervalMs?: number;
  /** Grace period to let in-flight handlers settle on stop(). */
  shutdownGraceMs?: number;
}

export interface JobRunnerDeps {
  repository: IJobRepository;
  tracer: IJobTracer;
  idGenerator: IIdGenerator;
  config?: JobRunnerConfig;
}

const DEFAULTS = {
  maxConcurrency: 2,
  minIdleMs: 500,
  maxIdleMs: 30_000,
  jobTimeoutMs: 60_000,
  backoffBaseMs: 1_000,
  backoffMaxMs: 5 * 60_000,
  staleAfterMs: 5 * 60_000,
  retentionMs: 7 * 24 * 60 * 60_000,
  pruneIntervalMs: 6 * 60 * 60_000,
  shutdownGraceMs: 5_000,
} as const;

export class JobRunner implements IJobQueue {
  private readonly repo: IJobRepository;
  private readonly tracer: IJobTracer;
  private readonly ids: IIdGenerator;
  private readonly cfg: Required<JobRunnerConfig>;
  private readonly backoff: BackoffPolicy;

  private readonly handlers = new Map<string, JobHandler>();
  private readonly inFlight = new Set<string>();

  private running = false;
  private idleMs: number;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(deps: JobRunnerDeps) {
    this.repo = deps.repository;
    this.tracer = deps.tracer;
    this.ids = deps.idGenerator;
    this.cfg = { ...DEFAULTS, ...(deps.config ?? {}) };
    this.backoff = { baseMs: this.cfg.backoffBaseMs, maxMs: this.cfg.backoffMaxMs };
    this.idleMs = this.cfg.minIdleMs;
  }

  /** Register a handler for a job `type`. Throws on duplicate registration. */
  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      throw new Error(`[JobRunner] handler already registered for type "${type}"`);
    }
    this.handlers.set(type, handler);
  }

  /** Persist a new job. Wakes the loop so it runs promptly when due. */
  async enqueue(type: string, payload?: unknown, opts: EnqueueJobOptions = {}): Promise<string> {
    const now = new Date();
    const job = JobEntity.create({
      id: this.ids.generate(),
      type,
      payload,
      maxAttempts: opts.maxAttempts,
      runAfter: opts.delayMs ? new Date(now.getTime() + opts.delayMs) : now,
      now,
    });
    await this.repo.save(job);
    this.wake();
    return job.id;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.idleMs = this.cfg.minIdleMs;

    await this.recoverStale();

    this.pruneTimer = setInterval(() => void this.prune(), this.cfg.pruneIntervalMs);
    void this.prune();

    this.scheduleTick(0);
    logger.info('[JobRunner] started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.tickTimer) clearTimeout(this.tickTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.tickTimer = null;
    this.pruneTimer = null;

    // Best-effort: let in-flight handlers finish. Anything still running stays
    // `running` in the DB and is recovered on the next launch.
    const deadline = Date.now() + this.cfg.shutdownGraceMs;
    while (this.inFlight.size > 0 && Date.now() < deadline) {
      await delay(100);
    }
    logger.info('[JobRunner] stopped');
  }

  // ===========================================================================

  private scheduleTick(ms: number): void {
    if (!this.running) return;
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.tickTimer = setTimeout(() => {
      this.tickTimer = null;
      void this.tick();
    }, ms);
  }

  /** Clear any pending wait and poll immediately (work arrived / a slot freed). */
  private wake(): void {
    if (!this.running) return;
    this.idleMs = this.cfg.minIdleMs;
    this.scheduleTick(0);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    const capacity = this.cfg.maxConcurrency - this.inFlight.size;
    if (capacity <= 0) {
      this.scheduleTick(this.cfg.minIdleMs);
      return;
    }

    let claimed: JobEntity[];
    try {
      claimed = await this.repo.claimDue(new Date(), capacity);
    } catch (err) {
      logger.error('[JobRunner] claim failed:', err);
      this.scheduleTick(this.idleMs);
      return;
    }

    if (claimed.length === 0) {
      // Nothing due — back off so an idle app isn't polling on a tight loop.
      this.idleMs = Math.min(this.idleMs * 2, this.cfg.maxIdleMs);
      this.scheduleTick(this.idleMs);
      return;
    }

    this.idleMs = this.cfg.minIdleMs;
    for (const job of claimed) void this.run(job);
    // Keep draining while slots may remain; capacity gate stops a busy-loop.
    this.scheduleTick(0);
  }

  private async run(job: JobEntity): Promise<void> {
    this.inFlight.add(job.id);
    const span = this.tracer.startSpan(`job.${job.type}`, {
      'job.id': job.id,
      'job.type': job.type,
      'job.attempt': job.attempts + 1,
    });

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error(`job timed out after ${this.cfg.jobTimeoutMs}ms`)),
      this.cfg.jobTimeoutMs,
    );

    try {
      const handler = this.handlers.get(job.type);
      if (!handler) throw new Error(`no handler registered for job type "${job.type}"`);

      await handler(job.parsePayload(), {
        signal: controller.signal,
        attempt: job.attempts + 1,
        jobId: job.id,
      });

      job.markSucceeded(new Date());
      span.end('ok');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = job.markFailed(message, new Date(), this.backoff);
      span.setAttribute('job.outcome', status);
      span.recordError(err);
      span.end('error');
      if (status === 'dead') {
        logger.error(
          `[JobRunner] job ${job.id} (${job.type}) gave up after ${job.attempts} attempts: ${message}`,
        );
      }
    } finally {
      clearTimeout(timeout);
      try {
        await this.repo.save(job);
      } catch (err) {
        logger.error(`[JobRunner] failed to persist result for job ${job.id}:`, err);
      }
      this.inFlight.delete(job.id);
      this.wake();
    }
  }

  private async recoverStale(): Promise<void> {
    try {
      const staleBefore = new Date(Date.now() - this.cfg.staleAfterMs);
      const stale = await this.repo.findStaleRunning(staleBefore);
      for (const job of stale) {
        job.recoverFromStale(new Date(), this.backoff);
        await this.repo.save(job);
      }
      if (stale.length > 0) {
        logger.info(`[JobRunner] recovered ${stale.length} orphaned job(s) from a previous run`);
      }
    } catch (err) {
      logger.error('[JobRunner] stale-job recovery failed:', err);
    }
  }

  private async prune(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.cfg.retentionMs);
      const removed = await this.repo.pruneTerminal(cutoff);
      if (removed > 0) logger.info(`[JobRunner] pruned ${removed} finished job(s)`);
    } catch (err) {
      logger.error('[JobRunner] retention prune failed:', err);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
