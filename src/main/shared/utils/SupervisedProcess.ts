/**
 * SupervisedProcess — a reusable supervisor for a long-running child process.
 *
 * Owns the lifecycle that integration adapters keep hand-rolling: spawn the
 * process, wait for it to become healthy, restart it lazily when it dies or
 * wedges, and — crucially — STOP relaunching a process that keeps dying so a
 * broken binary can't pin a user's CPU in a respawn loop.
 *
 * Concretely:
 *   • Lazy start — `ensureReady()` spawns on first use (concurrent callers
 *     share one in-flight start).
 *   • Health gate — after spawn, `healthCheck()` must resolve within
 *     `healthCheckTimeoutMs`, else the process is killed and start fails.
 *   • Circuit breaker — at most `maxRestarts` (re)spawns within
 *     `restartWindowMs`; beyond that `ensureReady()` fails fast until the
 *     window clears, instead of hammering the machine.
 *   • Backoff — each successive respawn waits longer (capped), so a flapping
 *     process is retried gently, not in a tight loop.
 *   • markUnhealthy — a consumer that detects a wedge (e.g. a request timed
 *     out) tears the process down so the next `ensureReady()` respawns it;
 *     this counts toward the circuit breaker.
 *
 * The process is injected via a `spawn` callback and probed via a `healthCheck`
 * callback, so the supervisor is process-agnostic and unit-testable without a
 * real OS process.
 */

import { logger } from './logger';

/** Minimal surface the supervisor needs — satisfied by Node's ChildProcess. */
export interface SupervisableProcess {
  once(event: 'exit', listener: (code: number | null) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
  readonly killed: boolean;
}

export interface SupervisedProcessOptions {
  /** Human-readable name for logs. */
  name: string;
  /** Create (spawn) the process. Called on each (re)start. */
  spawn: () => SupervisableProcess | Promise<SupervisableProcess>;
  /** Resolve once the process is ready to serve; reject/throw if not. */
  healthCheck: () => Promise<void>;
  healthCheckTimeoutMs?: number;
  /** Max (re)spawn attempts within `restartWindowMs` before the breaker opens. */
  maxRestarts?: number;
  restartWindowMs?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  /** Grace period for SIGTERM before escalating to SIGKILL. */
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

export class SupervisedProcess {
  private readonly name: string;
  private readonly opts: Required<Omit<SupervisedProcessOptions, 'name'>>;

  private proc: SupervisableProcess | null = null;
  private ready = false;
  private starting: Promise<void> | null = null;
  private terminating: Promise<void> | null = null;
  private generation = 0;
  /** Timestamps of recent spawn attempts — the circuit-breaker window. */
  private spawnTimes: number[] = [];

  constructor(options: SupervisedProcessOptions) {
    this.name = options.name;
    this.opts = {
      spawn: options.spawn,
      healthCheck: options.healthCheck,
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

  /** Ensure the process is up and healthy, spawning it if needed. */
  async ensureReady(): Promise<void> {
    if (this.terminating) await this.terminating;
    if (this.isReady()) return;
    this.starting ??= this.doStart(this.generation);
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  /**
   * Tear down the current process because it's wedged/misbehaving. The next
   * `ensureReady()` will respawn it (subject to the circuit breaker). Counts as
   * a fault — the respawn is what trips the breaker if it keeps happening.
   */
  async markUnhealthy(reason: string): Promise<void> {
    if (!this.proc && !this.ready) return;
    logger.warn(`[${this.name}] marked unhealthy: ${reason} — will respawn on next use`);
    await this.terminate(false);
  }

  /** Graceful, full stop (app shutdown). Clears the circuit-breaker memory. */
  async stop(): Promise<void> {
    this.generation += 1;
    await this.terminate(false);
    if (this.starting) {
      try {
        await this.starting;
      } catch {
        // A stop intentionally cancels an in-flight start.
      }
    }
    await this.terminate(false);
    this.spawnTimes = [];
  }

  // ===========================================================================

  private async terminate(clearSpawnTimes: boolean): Promise<void> {
    if (clearSpawnTimes) this.spawnTimes = [];
    if (this.terminating) {
      await this.terminating;
      return;
    }

    const proc = this.proc;
    this.ready = false;
    if (!proc) return;

    this.terminating = this.terminateProcess(proc).finally(() => {
      if (this.proc === proc) this.proc = null;
      this.terminating = null;
    });
    await this.terminating;
  }

  private async terminateProcess(proc: SupervisableProcess): Promise<void> {
    const exitedAfterTerm = await signalAndWait(proc, 'SIGTERM', this.opts.terminationGraceMs);
    if (exitedAfterTerm) return;

    logger.warn(`[${this.name}] did not exit after SIGTERM; escalating to SIGKILL`);
    const exitedAfterKill = await signalAndWait(proc, 'SIGKILL', this.opts.terminationGraceMs);
    if (!exitedAfterKill) {
      logger.error(`[${this.name}] did not report exit after SIGKILL`);
    }
  }

  private async doStart(generation: number): Promise<void> {
    const now = Date.now();
    // Drop spawn attempts older than the window, then check the breaker.
    this.spawnTimes = this.spawnTimes.filter((t) => now - t < this.opts.restartWindowMs);
    if (this.spawnTimes.length >= this.opts.maxRestarts) {
      throw new Error(
        `[${this.name}] circuit open: ${this.spawnTimes.length} spawn attempts within ` +
          `${this.opts.restartWindowMs}ms — refusing to relaunch until it settles`,
      );
    }

    // Back off proportionally to how many times we've spawned recently.
    if (this.spawnTimes.length > 0) {
      const delay = Math.min(
        this.opts.backoffBaseMs * 2 ** (this.spawnTimes.length - 1),
        this.opts.backoffMaxMs,
      );
      await sleep(delay);
    }
    if (generation !== this.generation) throw new Error(`[${this.name}] start cancelled`);
    this.spawnTimes.push(now);

    const proc = await this.opts.spawn();
    this.proc = proc;
    proc.once('exit', (code) => {
      // Only react if this is still the live process (not one we replaced).
      if (this.proc === proc) {
        this.proc = null;
        this.ready = false;
      }
      if (code) logger.warn(`[${this.name}] exited with code ${code}`);
    });
    if (generation !== this.generation) {
      await this.terminate(false);
      throw new Error(`[${this.name}] start cancelled`);
    }

    try {
      await withTimeout(
        this.opts.healthCheck(),
        this.opts.healthCheckTimeoutMs,
        `[${this.name}] health check timed out after ${this.opts.healthCheckTimeoutMs}ms`,
      );
    } catch (err) {
      await this.terminate(false);
      throw err;
    }

    this.ready = true;
    logger.info(`[${this.name}] ready`);
  }
}

function signalAndWait(
  proc: SupervisableProcess,
  signal: NodeJS.Signals,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(exited);
    };
    proc.once('exit', () => finish(true));
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      proc.kill(signal);
    } catch {
      finish(true);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
