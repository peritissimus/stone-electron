/**
 * JobEntity — a unit of durable background work.
 *
 * Owns the lifecycle rules of a queued job: how it transitions between states,
 * how a failure is rescheduled with exponential backoff, and when a job that
 * keeps failing is given up on (`dead`) so it can never loop forever on a
 * user's machine. Pure domain logic — no I/O, no timers, no clock of its own
 * (callers pass `now`).
 */

export type JobStatus = 'pending' | 'running' | 'done' | 'dead';

export interface JobProps {
  id: string;
  type: string;
  /** JSON-encoded handler payload. */
  payload: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
  claimedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobInput {
  id: string;
  type: string;
  /** Serialized to JSON; defaults to `{}`. */
  payload?: unknown;
  maxAttempts?: number;
  /** Earliest run time; defaults to `now` (run ASAP). */
  runAfter?: Date;
  now: Date;
}

/** Exponential backoff bounds. delay = min(baseMs * 2^(attempt-1), maxMs). */
export interface BackoffPolicy {
  baseMs: number;
  maxMs: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
/** Persisted error strings are capped so a giant stack can't bloat the row. */
const MAX_ERROR_LEN = 2000;

export class JobEntity {
  private constructor(private props: JobProps) {}

  static create(input: CreateJobInput): JobEntity {
    return new JobEntity({
      id: input.id,
      type: input.type,
      payload: JSON.stringify(input.payload ?? {}),
      status: 'pending',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      runAfter: input.runAfter ?? input.now,
      claimedAt: null,
      lastError: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static fromPersistence(props: JobProps): JobEntity {
    return new JobEntity({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get type(): string {
    return this.props.type;
  }
  get status(): JobStatus {
    return this.props.status;
  }
  get attempts(): number {
    return this.props.attempts;
  }
  get lastError(): string | null {
    return this.props.lastError;
  }

  parsePayload<T = unknown>(): T {
    return JSON.parse(this.props.payload) as T;
  }

  /** Mark as claimed by a runner and about to execute. */
  markRunning(now: Date): void {
    this.props.status = 'running';
    this.props.claimedAt = now;
    this.props.updatedAt = now;
  }

  /** Handler completed successfully — terminal. */
  markSucceeded(now: Date): void {
    this.props.status = 'done';
    this.props.claimedAt = null;
    this.props.lastError = null;
    this.props.updatedAt = now;
  }

  /**
   * Handler threw. Counts the attempt, then either reschedules with backoff
   * (status `pending`) or, once attempts are exhausted, gives up (status
   * `dead`). Returns the resulting status so callers can log dead-letters.
   */
  markFailed(error: string, now: Date, backoff: BackoffPolicy): JobStatus {
    this.props.attempts += 1;
    this.props.lastError = error.slice(0, MAX_ERROR_LEN);
    this.props.claimedAt = null;
    this.props.updatedAt = now;

    if (this.props.attempts >= this.props.maxAttempts) {
      this.props.status = 'dead';
    } else {
      this.props.status = 'pending';
      const delay = Math.min(backoff.baseMs * 2 ** (this.props.attempts - 1), backoff.maxMs);
      this.props.runAfter = new Date(now.getTime() + delay);
    }
    return this.props.status;
  }

  /**
   * Re-queue a job left in `running` by a crash. Treated as a failed attempt so
   * a job that reliably kills the process still dies eventually instead of
   * relaunching forever.
   */
  recoverFromStale(now: Date, backoff: BackoffPolicy): JobStatus {
    return this.markFailed('orphaned in running state (process restart)', now, backoff);
  }

  toPersistence(): JobProps {
    return { ...this.props };
  }
}
