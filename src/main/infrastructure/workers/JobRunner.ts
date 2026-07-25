/**
 * Effect-backed durable job runner.
 *
 * The class is the temporary Promise facade used by application features that
 * have not reached migration Phase 3. All concurrency, time, interruption, and
 * retry scheduling inside the worker are Effect-native.
 */

import { Effect, Fiber, Layer, Schedule } from 'effect';
import type {
  EnqueueJobOptions,
  IJobQueue,
  IJobQueueEffect,
  IJobRepository,
  IIdGenerator,
} from '../../domain';
import { JobEntity, JobQueue } from '../../domain';
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
  retentionMs?: number;
  pruneIntervalMs?: number;
  shutdownGraceMs?: number;
}

export interface JobRunnerDeps {
  repository: IJobRepository;
  idGenerator: IIdGenerator;
  config?: JobRunnerConfig;
  /** Worker-bootstrap runtime; injectable so TestClock controls every fiber. */
  runtime?: JobRunnerRuntime;
}

export interface JobRunnerRuntime {
  runPromise<A, E>(effect: Effect.Effect<A, E>): Promise<A>;
  runFork<A, E>(effect: Effect.Effect<A, E>): Fiber.RuntimeFiber<A, E>;
}

const DEFAULTS = {
  maxConcurrency: 2,
  minIdleMs: 500,
  maxIdleMs: 30_000,
  jobTimeoutMs: 60_000,
  backoffBaseMs: 1_000,
  backoffMaxMs: 5 * 60_000,
  retentionMs: 7 * 24 * 60 * 60_000,
  pruneIntervalMs: 6 * 60 * 60_000,
  shutdownGraceMs: 5_000,
} as const;

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function promiseEffect<A>(evaluate: (signal: AbortSignal) => Promise<A>): Effect.Effect<A, Error> {
  return Effect.tryPromise({ try: evaluate, catch: asError });
}

/**
 * The runner owns both schedules. `union(spaced(cap))` turns an unbounded
 * exponential schedule into a capped one by always choosing the shorter delay.
 */
export function makeJobRunnerSchedules(config: Required<JobRunnerConfig>) {
  return {
    idle: Schedule.exponential(config.minIdleMs).pipe(
      Schedule.union(Schedule.spaced(config.maxIdleMs)),
    ),
    retry: Schedule.exponential(config.backoffBaseMs).pipe(
      Schedule.union(Schedule.spaced(config.backoffMaxMs)),
    ),
  } as const;
}

export class JobRunner implements IJobQueue {
  static layer(runner: JobRunner): Layer.Layer<IJobQueueEffect, Error> {
    return Layer.scoped(
      JobQueue,
      Effect.acquireRelease(
        promiseEffect(() => runner.start()).pipe(Effect.as(runner.effect)),
        () =>
          promiseEffect(() => runner.stop()).pipe(
            Effect.catchAll((error) =>
              Effect.sync(() => logger.error('[JobRunner] finalizer failed:', error)),
            ),
          ),
      ),
    );
  }

  private readonly repo: IJobRepository;
  private readonly ids: IIdGenerator;
  private readonly cfg: Required<JobRunnerConfig>;
  private readonly runtime: JobRunnerRuntime;
  readonly schedules: ReturnType<typeof makeJobRunnerSchedules>;

  private readonly handlers = new Map<string, JobHandler>();
  private readonly inFlight = new Map<string, Fiber.RuntimeFiber<void, never>>();
  private readonly pollFibers = new Set<Fiber.RuntimeFiber<never, never>>();
  private loopFiber: Fiber.RuntimeFiber<never, never> | null = null;
  private pruneFiber: Fiber.RuntimeFiber<never, never> | null = null;
  private semaphore: Effect.Semaphore | null = null;
  private running = false;

  constructor(deps: JobRunnerDeps) {
    this.repo = deps.repository;
    this.ids = deps.idGenerator;
    this.cfg = { ...DEFAULTS, ...(deps.config ?? {}) };
    this.runtime = deps.runtime ?? {
      runPromise: Effect.runPromise,
      runFork: Effect.runFork,
    };
    this.schedules = makeJobRunnerSchedules(this.cfg);
  }

  /** Effect-native capability supplied by the Phase 1 layer. */
  readonly effect: IJobQueueEffect = {
    enqueue: (type, payload, options) => this.enqueueEffect(type, payload, options),
  };

  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      throw new Error(`[JobRunner] handler already registered for type "${type}"`);
    }
    this.handlers.set(type, handler);
  }

  enqueue(type: string, payload?: unknown, options?: EnqueueJobOptions): Promise<string> {
    return this.runtime.runPromise(this.enqueueEffect(type, payload, options));
  }

  private enqueueEffect(
    type: string,
    payload?: unknown,
    options: EnqueueJobOptions = {},
  ): Effect.Effect<string, Error> {
    return Effect.gen(this, function* () {
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
      const job = JobEntity.create({
        id: this.ids.generate(),
        type,
        payload,
        maxAttempts: options.maxAttempts,
        runAfter: options.delayMs ? new Date(now + options.delayMs) : new Date(now),
        now: new Date(now),
      });
      yield* promiseEffect(() => this.repo.save(job));
      this.wake();
      return job.id;
    });
  }

  start(): Promise<void> {
    return this.runtime.runPromise(
      Effect.gen(this, function* () {
        if (this.running) return;
        this.running = true;
        this.semaphore = yield* Effect.makeSemaphore(this.cfg.maxConcurrency);
        yield* this.recoverOrphaned();
        this.startFibers();
        logger.info('[JobRunner] started');
      }),
    );
  }

  stop(): Promise<void> {
    return this.runtime.runPromise(
      Effect.gen(this, function* () {
        if (!this.running) return;
        this.running = false;

        const background = [...this.pollFibers, this.pruneFiber].filter(
          (fiber): fiber is Fiber.RuntimeFiber<never, never> => fiber !== null,
        );
        this.loopFiber = null;
        this.pruneFiber = null;
        yield* this.interruptWithinGrace(background, 'poller');

        const jobs = [...this.inFlight.values()];
        yield* this.interruptWithinGrace(jobs, 'job');
        logger.info('[JobRunner] stopped');
      }),
    );
  }

  private startFibers(): void {
    if (!this.running) return;
    this.loopFiber = this.startPollFiber();
    this.pruneFiber = this.runtime.runFork(
      this.prune().pipe(
        Effect.repeat(Schedule.spaced(this.cfg.pruneIntervalMs)),
        Effect.asVoid,
        Effect.forever,
      ),
    );
  }

  /** Work arrival resets adaptive backoff by interrupting only the idle poll fiber. */
  private wake(): void {
    if (!this.running) return;
    const previous = this.loopFiber;
    this.loopFiber = this.startPollFiber();
    if (previous) this.runtime.runFork(Fiber.interrupt(previous));
  }

  private startPollFiber(): Fiber.RuntimeFiber<never, never> {
    let fiber!: Fiber.RuntimeFiber<never, never>;
    fiber = this.runtime.runFork(
      this.pollProgram().pipe(
        Effect.ensuring(
          Effect.sync(() => {
            this.pollFibers.delete(fiber);
          }),
        ),
      ),
    );
    this.pollFibers.add(fiber);
    return fiber;
  }

  private pollProgram(): Effect.Effect<never, never> {
    const idleUntilWork = this.pollOnce().pipe(
      Effect.repeat(this.schedules.idle.pipe(Schedule.whileInput((worked) => !worked))),
    );
    return Effect.forever(idleUntilWork);
  }

  private pollOnce(): Effect.Effect<boolean, never> {
    return Effect.gen(this, function* () {
      if (!this.running) return false;
      const capacity = this.cfg.maxConcurrency - this.inFlight.size;
      if (capacity <= 0) {
        yield* Effect.sleep(this.cfg.minIdleMs);
        return true;
      }
      return yield* this.claimAndLaunch(capacity);
    });
  }

  /**
   * Claiming flips rows to `running` inside the repository transaction, and the
   * transaction commits even if this fiber is abandoned mid-await. An interrupt
   * from wake() or stop() landing between the claim and launch() would strand
   * those rows until the next start(), so interruption must wait at this
   * region's edge. When stop() won the race, the claim is released back to
   * pending here instead of running.
   */
  private claimAndLaunch(capacity: number): Effect.Effect<boolean, never> {
    return Effect.uninterruptible(
      Effect.gen(this, function* () {
        const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
        const claimed = yield* promiseEffect(() =>
          this.repo.claimDue(new Date(now), capacity),
        ).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              logger.error('[JobRunner] claim failed:', error);
              return [] as JobEntity[];
            }),
          ),
        );
        if (claimed.length === 0) return false;

        if (!this.running) {
          yield* Effect.forEach(claimed, (job) => this.persistReleasedClaim(job), {
            discard: true,
          });
          return true;
        }

        for (const job of claimed) this.launch(job);
        return true;
      }),
    );
  }

  /**
   * Shutdown must not fail when a fiber outlives the grace period: anything
   * still `running` in the DB is swept by recoverOrphaned() on next start.
   */
  private interruptWithinGrace<A, E>(
    fibers: ReadonlyArray<Fiber.RuntimeFiber<A, E>>,
    what: string,
  ): Effect.Effect<void, never> {
    if (fibers.length === 0) return Effect.void;
    return Effect.forEach(fibers, Fiber.interrupt, { discard: true }).pipe(
      Effect.timeout(this.cfg.shutdownGraceMs),
      Effect.catchTag('TimeoutException', () =>
        Effect.sync(() =>
          logger.warn(
            `[JobRunner] ${fibers.length} ${what} fiber(s) exceeded the ${this.cfg.shutdownGraceMs}ms shutdown grace`,
          ),
        ),
      ),
    );
  }

  private launch(job: JobEntity): void {
    const semaphore = this.semaphore;
    if (!semaphore) return;
    const program = semaphore.withPermits(1)(
      this.runJob(job).pipe(Effect.onInterrupt(() => this.persistInterrupted(job))),
    ).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          this.inFlight.delete(job.id);
          this.wake();
        }),
      ),
    );
    const fiber = this.runtime.runFork(program);
    this.inFlight.set(job.id, fiber);
  }

  private runJob(job: JobEntity): Effect.Effect<void, never> {
    const execute = Effect.gen(this, function* () {
      const handler = this.handlers.get(job.type);
      if (!handler) return yield* Effect.fail(new Error(`no handler for job type "${job.type}"`));
      yield* promiseEffect((signal) =>
        handler(job.parsePayload(), {
          signal,
          attempt: job.attempts + 1,
          jobId: job.id,
        }),
      );
    }).pipe(
      Effect.timeoutFail({
        duration: this.cfg.jobTimeoutMs,
        onTimeout: () => new Error(`job timed out after ${this.cfg.jobTimeoutMs}ms`),
      }),
    );

    return Effect.matchEffect(execute, {
      onFailure: (error) =>
        Effect.gen(this, function* () {
          const message = error.message;
          const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
          const status = job.markFailed(message, new Date(now), this.nextRetryAt(job, now));
          yield* Effect.annotateCurrentSpan('job.outcome', status);
          yield* Effect.annotateCurrentSpan('job.error', message);
          if (status === 'dead') {
            logger.error(
              `[JobRunner] job ${job.id} (${job.type}) gave up after ${job.attempts} attempts: ${message}`,
            );
          }
          yield* this.persistResult(job);
        }),
      onSuccess: () =>
        Effect.gen(this, function* () {
          const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
          job.markSucceeded(new Date(now));
          yield* Effect.annotateCurrentSpan('job.outcome', 'done');
          yield* this.persistResult(job);
        }),
    }).pipe(
      Effect.withSpan(`job.${job.type}`, {
        attributes: {
          'job.id': job.id,
          'job.type': job.type,
          'job.attempt': job.attempts + 1,
        },
      }),
    );
  }

  private persistResult(job: JobEntity): Effect.Effect<void, never> {
    return promiseEffect(() => this.repo.save(job)).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => logger.error(`[JobRunner] failed to persist job ${job.id}:`, error)),
      ),
    );
  }

  private persistInterrupted(job: JobEntity): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
      job.markFailed('job runner interrupted', new Date(now), this.nextRetryAt(job, now));
      yield* this.persistResult(job);
    });
  }

  private persistReleasedClaim(job: JobEntity): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
      job.releaseClaim(new Date(now));
      yield* this.persistResult(job);
    });
  }

  private recoverOrphaned(): Effect.Effect<void, Error> {
    return Effect.gen(this, function* () {
      const orphaned = yield* promiseEffect(() => this.repo.findRunning());
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
      for (const job of orphaned) {
        job.recoverFromStale(new Date(now), this.nextRetryAt(job, now));
        yield* promiseEffect(() => this.repo.save(job));
      }
      if (orphaned.length > 0) {
        logger.info(`[JobRunner] recovered ${orphaned.length} orphaned job(s)`);
      }
    });
  }

  private prune(): Effect.Effect<void, never> {
    return Effect.gen(this, function* () {
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
      const removed = yield* promiseEffect(() =>
        this.repo.pruneTerminal(new Date(now - this.cfg.retentionMs)),
      );
      if (removed > 0) logger.info(`[JobRunner] pruned ${removed} finished job(s)`);
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => logger.error('[JobRunner] retention prune failed:', error)),
      ),
    );
  }

  /** Interpret the runner-owned exponential retry policy for durable storage. */
  private nextRetryAt(job: JobEntity, now: number): Date {
    const delay = Math.min(
      this.cfg.backoffBaseMs * 2 ** job.attempts,
      this.cfg.backoffMaxMs,
    );
    return new Date(now + delay);
  }
}
