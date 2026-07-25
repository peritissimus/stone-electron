/**
 * Effect-native lifecycle supervisor for a long-running child process.
 *
 * Promise methods are a temporary compatibility facade. The actual lifecycle
 * is expressed with Scope/acquireRelease, Effect timeout/interruption, and the
 * Effect clock so it is deterministic under TestClock.
 */

import { Effect, Exit, Scope } from 'effect';
import { logger } from './logger';

export interface SupervisableProcess {
  once(event: 'exit', listener: (code: number | null) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
  readonly killed: boolean;
}

type RunPromise = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;

export interface SupervisedProcessOptions {
  name: string;
  spawn: (signal?: AbortSignal) => SupervisableProcess | Promise<SupervisableProcess>;
  healthCheck: (signal?: AbortSignal) => Promise<void>;
  /** Supplied by the worker bootstrap; this utility never invokes a runtime. */
  runPromise: RunPromise;
  healthCheckTimeoutMs?: number;
  maxRestarts?: number;
  restartWindowMs?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  terminationGraceMs?: number;
}

const DEFAULTS = {
  healthCheckTimeoutMs: 30_000,
  maxRestarts: 5,
  restartWindowMs: 60_000,
  backoffBaseMs: 500,
  backoffMaxMs: 10_000,
  terminationGraceMs: 2_000,
} as const;

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class SupervisedProcess {
  private readonly name: string;
  private readonly opts: Required<Omit<SupervisedProcessOptions, 'name'>>;

  private proc: SupervisableProcess | null = null;
  private processScope: Scope.CloseableScope | null = null;
  private ready = false;
  private starting: Promise<void> | null = null;
  private terminating: Promise<void> | null = null;
  private generation = 0;
  private spawnTimes: number[] = [];

  constructor(options: SupervisedProcessOptions) {
    this.name = options.name;
    this.opts = {
      spawn: options.spawn,
      healthCheck: options.healthCheck,
      runPromise: options.runPromise,
      healthCheckTimeoutMs: options.healthCheckTimeoutMs ?? DEFAULTS.healthCheckTimeoutMs,
      maxRestarts: options.maxRestarts ?? DEFAULTS.maxRestarts,
      restartWindowMs: options.restartWindowMs ?? DEFAULTS.restartWindowMs,
      backoffBaseMs: options.backoffBaseMs ?? DEFAULTS.backoffBaseMs,
      backoffMaxMs: options.backoffMaxMs ?? DEFAULTS.backoffMaxMs,
      terminationGraceMs: options.terminationGraceMs ?? DEFAULTS.terminationGraceMs,
    };
  }

  isReady(): boolean {
    return this.proc !== null && this.ready;
  }

  ensureReady(): Promise<void> {
    if (this.terminating) {
      return this.terminating.then(() => this.ensureReady());
    }
    if (this.isReady()) return Promise.resolve();
    this.starting ??= this.opts.runPromise(this.ensureReadyEffect(this.generation));
    return this.starting.finally(() => {
      this.starting = null;
    });
  }

  markUnhealthy(reason: string): Promise<void> {
    if (!this.proc && !this.ready) return Promise.resolve();
    logger.warn(`[${this.name}] marked unhealthy: ${reason} — will respawn on next use`);
    return this.terminate();
  }

  async stop(): Promise<void> {
    this.generation += 1;
    await this.terminate();
    if (this.starting) {
      try {
        await this.starting;
      } catch {
        // Closing the lifecycle intentionally invalidates the in-flight start.
      }
    }
    await this.terminate();
    this.spawnTimes = [];
  }

  /** Public for deterministic Effect/TestClock suites. */
  ensureReadyEffect(generation = this.generation): Effect.Effect<void, Error> {
    return Effect.gen(this, function* () {
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
      this.spawnTimes = this.spawnTimes.filter((time) => now - time < this.opts.restartWindowMs);
      if (this.spawnTimes.length >= this.opts.maxRestarts) {
        return yield* Effect.fail(
          new Error(
            `[${this.name}] circuit open: ${this.spawnTimes.length} spawn attempts within ` +
              `${this.opts.restartWindowMs}ms`,
          ),
        );
      }

      if (this.spawnTimes.length > 0) {
        const backoffMs = Math.min(
          this.opts.backoffBaseMs * 2 ** (this.spawnTimes.length - 1),
          this.opts.backoffMaxMs,
        );
        yield* Effect.sleep(backoffMs);
      }
      if (generation !== this.generation) {
        return yield* Effect.fail(new Error(`[${this.name}] start cancelled`));
      }
      this.spawnTimes.push(now);

      const scope = yield* Scope.make();
      this.processScope = scope;
      const acquire = Effect.acquireRelease(
        Effect.tryPromise({
          try: (signal) => Promise.resolve(this.opts.spawn(signal)),
          catch: asError,
        }),
        (proc) => this.terminateProcessEffect(proc),
      );

      const proc = yield* Scope.extend(acquire, scope).pipe(
        Effect.onError(() => Scope.close(scope, Exit.void)),
      );
      this.proc = proc;
      proc.once('exit', (code) => {
        if (this.proc === proc) {
          this.proc = null;
          this.processScope = null;
          this.ready = false;
        }
        if (code) logger.warn(`[${this.name}] exited with code ${code}`);
      });

      if (generation !== this.generation) {
        yield* Scope.close(scope, Exit.void);
        return yield* Effect.fail(new Error(`[${this.name}] start cancelled`));
      }

      yield* Effect.tryPromise({
        try: (signal) => this.opts.healthCheck(signal),
        catch: asError,
      }).pipe(
        Effect.timeoutFail({
          duration: this.opts.healthCheckTimeoutMs,
          onTimeout: () =>
            new Error(
              `[${this.name}] health check timed out after ${this.opts.healthCheckTimeoutMs}ms`,
            ),
        }),
        Effect.onError(() => Scope.close(scope, Exit.void)),
      );

      this.ready = true;
      logger.info(`[${this.name}] ready`);
    });
  }

  private terminate(): Promise<void> {
    if (this.terminating) return this.terminating;
    const scope = this.processScope;
    this.ready = false;
    if (!scope) return Promise.resolve();

    this.processScope = null;
    this.terminating = this.opts.runPromise(Scope.close(scope, Exit.void)).finally(() => {
      this.proc = null;
      this.terminating = null;
    });
    return this.terminating;
  }

  private terminateProcessEffect(proc: SupervisableProcess): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const exitedAfterTerm = yield* signalAndWaitEffect(
        proc,
        'SIGTERM',
        this.opts.terminationGraceMs,
      );
      if (exitedAfterTerm) return;

      logger.warn(`[${this.name}] did not exit after SIGTERM; escalating to SIGKILL`);
      const exitedAfterKill = yield* signalAndWaitEffect(
        proc,
        'SIGKILL',
        this.opts.terminationGraceMs,
      );
      if (!exitedAfterKill) logger.error(`[${this.name}] did not report exit after SIGKILL`);
    });
  }
}

function signalAndWaitEffect(
  proc: SupervisableProcess,
  signal: NodeJS.Signals,
  timeoutMs: number,
): Effect.Effect<boolean> {
  const exited = Effect.async<boolean>((resume) => {
    proc.once('exit', () => resume(Effect.succeed(true)));
    try {
      proc.kill(signal);
    } catch {
      resume(Effect.succeed(true));
    }
  });
  // acquireRelease finalizers are uninterruptible by default. Restore
  // interruptibility around the race so the losing exit waiter is cancelled
  // when the grace-period sleep wins.
  return Effect.race(exited, Effect.sleep(timeoutMs).pipe(Effect.as(false))).pipe(
    Effect.interruptible,
  );
}
