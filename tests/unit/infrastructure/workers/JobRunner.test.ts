import { ManagedRuntime, Schema, TestClock, TestContext } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobEntity } from '../../../../src/main/domain/entities/Job';
import type { IJobRepository } from '../../../../src/main/domain/ports/out/IJobRepository';
import {
  JobRunner,
  type JobRunnerConfig,
  type JobRunnerRuntime,
} from '../../../../src/main/infrastructure/workers/JobRunner';
import {
  createMeetingFinalizeJobHandler,
  MeetingFinalizeJobPayloadSchema,
} from '../../../../src/main/infrastructure/workers/meetingFinalizeJob';

class InMemoryJobRepository implements IJobRepository {
  readonly jobs = new Map<string, JobEntity>();

  async save(job: JobEntity): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async claimDue(now: Date, limit: number): Promise<JobEntity[]> {
    const due = [...this.jobs.values()]
      .filter((job) => {
        const props = job.toPersistence();
        return props.status === 'pending' && props.runAfter <= now;
      })
      .slice(0, limit);
    return due.map((job) => {
      const running = JobEntity.fromPersistence({
        ...job.toPersistence(),
        status: 'running',
        claimedAt: now,
        updatedAt: now,
      });
      this.jobs.set(running.id, running);
      return running;
    });
  }

  async findRunning(): Promise<JobEntity[]> {
    return [...this.jobs.values()].filter((job) => job.status === 'running');
  }

  async pruneTerminal(): Promise<number> {
    return 0;
  }

  async findById(id: string): Promise<JobEntity | null> {
    return this.jobs.get(id) ?? null;
  }
}

function createRunner(
  repository = new InMemoryJobRepository(),
  runtime?: JobRunnerRuntime,
  config: JobRunnerConfig = {},
) {
  const runner = new JobRunner({
    repository,
    idGenerator: { generate: vi.fn(() => 'job-1') },
    runtime,
    config: {
      minIdleMs: 5,
      maxIdleMs: 10,
      backoffBaseMs: 60_000,
      backoffMaxMs: 60_000,
      jobTimeoutMs: 60_000,
      pruneIntervalMs: 60_000,
      shutdownGraceMs: 100,
      ...config,
    },
  });
  return { repository, runner };
}

async function eventually(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }
  assertion();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JobRunner', () => {
  it('persists a retry when a handler throws', async () => {
    const { repository, runner } = createRunner();
    runner.register('test.fail', async () => {
      throw new Error('pipeline failed');
    });

    await runner.start();
    await runner.enqueue('test.fail', { value: 1 });
    await eventually(() => {
      const job = repository.jobs.get('job-1');
      expect(job?.status).toBe('pending');
      expect(job?.attempts).toBe(1);
      expect(job?.lastError).toBe('pipeline failed');
    });
    await runner.stop();
  });

  it('retries with TestClock backoff and dead-letters at maxAttempts', async () => {
    const runtime = ManagedRuntime.make(TestContext.TestContext);
    const { repository, runner } = createRunner(
      new InMemoryJobRepository(),
      {
        runPromise: (effect) => runtime.runPromise(effect),
        runFork: (effect) => runtime.runFork(effect),
      },
      {
        minIdleMs: 50,
        maxIdleMs: 1_000,
        backoffBaseMs: 100,
        backoffMaxMs: 1_000,
      },
    );
    runner.register('test.poison', async () => {
      throw new Error('transcription failed');
    });

    await runner.start();
    await runner.enqueue('test.poison', {}, { maxAttempts: 3 });
    await eventually(() => expect(repository.jobs.get('job-1')?.attempts).toBe(1));

    await runtime.runPromise(TestClock.adjust(200));
    await eventually(() => expect(repository.jobs.get('job-1')?.attempts).toBe(2));

    await runtime.runPromise(TestClock.adjust(400));
    await eventually(() => expect(repository.jobs.get('job-1')?.status).toBe('dead'));
    expect(repository.jobs.get('job-1')?.attempts).toBe(3);
    expect(repository.jobs.get('job-1')?.lastError).toBe('transcription failed');

    await runner.stop();
    await runtime.dispose();
  });

  it('aborts in-flight handlers when stopping', async () => {
    const { repository, runner } = createRunner();
    let receivedSignal: AbortSignal | undefined;
    runner.register(
      'test.abort',
      (_payload, context) =>
        new Promise<void>((_resolve, reject) => {
          receivedSignal = context.signal;
          context.signal.addEventListener('abort', () => reject(context.signal.reason), {
            once: true,
          });
        }),
    );

    await runner.start();
    await runner.enqueue('test.abort');
    await eventually(() => expect(receivedSignal).toBeDefined());
    await runner.stop();

    expect(receivedSignal?.aborted).toBe(true);
    expect(repository.jobs.get('job-1')?.attempts).toBe(1);
    expect(repository.jobs.get('job-1')?.status).toBe('pending');
  });

  it('does not strand a job claimed while wake() interrupts the poller', async () => {
    const inner = new InMemoryJobRepository();
    const releases: Array<() => void> = [];
    const repository: IJobRepository = {
      save: (job) => inner.save(job),
      findRunning: () => inner.findRunning(),
      pruneTerminal: () => inner.pruneTerminal(),
      findById: (id) => inner.findById(id),
      claimDue: async (now, limit) => {
        await new Promise<void>((resolve) => releases.push(resolve));
        return inner.claimDue(now, limit);
      },
    };
    const { runner } = createRunner(repository as InMemoryJobRepository);
    const executed: string[] = [];
    runner.register('test.race', async () => {
      executed.push('ran');
    });

    await runner.start();
    await eventually(() => expect(releases.length).toBe(1));

    // enqueue() saves the job, then wake() forks a fresh poller and interrupts
    // the one currently suspended inside claimDue.
    await runner.enqueue('test.race');
    await eventually(() => expect(releases.length).toBe(2));

    // Releasing the interrupted poller's claim flips the row to running; the
    // claim-and-launch region must still execute the job instead of dropping it.
    releases[0]();
    await eventually(() => {
      expect(executed).toEqual(['ran']);
      expect(inner.jobs.get('job-1')?.status).toBe('done');
    });

    releases.splice(0).forEach((release) => release());
    await runner.stop();
  });

  it('releases a stop-raced claim without charging an execution attempt', async () => {
    const inner = new InMemoryJobRepository();
    const releases: Array<() => void> = [];
    const repository: IJobRepository = {
      save: (job) => inner.save(job),
      findRunning: () => inner.findRunning(),
      pruneTerminal: () => inner.pruneTerminal(),
      findById: (id) => inner.findById(id),
      claimDue: async (now, limit) => {
        await new Promise<void>((resolve) => releases.push(resolve));
        return inner.claimDue(now, limit);
      },
    };
    const { runner } = createRunner(repository as InMemoryJobRepository, undefined, {
      shutdownGraceMs: 1_000,
    });
    const handler = vi.fn(async () => undefined);
    runner.register('test.stop-race', handler);

    await runner.start();
    await eventually(() => expect(releases.length).toBe(1));
    await runner.enqueue('test.stop-race', undefined, { maxAttempts: 1 });
    await eventually(() => expect(releases.length).toBe(2));

    const stopping = runner.stop();
    await Promise.resolve();
    releases.splice(0).forEach((release) => release());
    await stopping;

    expect(handler).not.toHaveBeenCalled();
    expect(inner.jobs.get('job-1')?.toPersistence()).toMatchObject({
      status: 'pending',
      attempts: 0,
      claimedAt: null,
      lastError: null,
    });
  });

  it('resolves stop() when interruption exceeds the shutdown grace', async () => {
    const inner = new InMemoryJobRepository();
    let saves = 0;
    const repository: IJobRepository = {
      findRunning: () => inner.findRunning(),
      pruneTerminal: () => inner.pruneTerminal(),
      findById: (id) => inner.findById(id),
      claimDue: (now, limit) => inner.claimDue(now, limit),
      save: (job) => {
        saves += 1;
        // The save issued by persistInterrupted during shutdown never settles,
        // so Fiber.interrupt hangs in the onInterrupt finalizer past the grace.
        if (saves > 1) return new Promise<void>(() => undefined);
        return inner.save(job);
      },
    };
    const { runner } = createRunner(repository as InMemoryJobRepository);
    let started = false;
    runner.register(
      'test.hang',
      () =>
        new Promise<void>(() => {
          started = true;
        }),
    );

    await runner.start();
    await runner.enqueue('test.hang');
    await eventually(() => expect(started).toBe(true));

    await expect(runner.stop()).resolves.toBeUndefined();
  });

  it('recovers every running job on startup, including a freshly claimed one', async () => {
    const { repository, runner } = createRunner();
    const claimedAt = new Date();
    const orphan = JobEntity.fromPersistence({
      ...JobEntity.create({
        id: 'orphan-1',
        type: 'test.orphan',
        now: claimedAt,
      }).toPersistence(),
      status: 'running',
      claimedAt,
    });
    repository.jobs.set(orphan.id, orphan);

    await runner.start();
    await runner.stop();

    expect(orphan.status).toBe('pending');
    expect(orphan.attempts).toBe(1);
  });
});

describe('meeting finalize job handler', () => {
  it('rejects malformed payloads before invoking the pipeline', async () => {
    const finalizeRecording = vi.fn();
    const handler = createMeetingFinalizeJobHandler(finalizeRecording);

    await expect(
      handler(
        { recordingId: '', durationMs: -1, extra: true },
        { signal: new AbortController().signal, attempt: 1, jobId: 'job-1' },
      ),
    ).rejects.toThrow();
    expect(finalizeRecording).not.toHaveBeenCalled();
    expect(
      Schema.decodeUnknownEither(MeetingFinalizeJobPayloadSchema)({ durationMs: 1 })._tag,
    ).toBe('Left');
  });

  it('passes validated payload and cancellation to the pipeline', async () => {
    const finalizeRecording = vi.fn().mockResolvedValue(undefined);
    const handler = createMeetingFinalizeJobHandler(finalizeRecording);
    const signal = new AbortController().signal;

    await handler(
      { recordingId: 'rec-1', durationMs: 1_500 },
      { signal, attempt: 1, jobId: 'job-1' },
    );

    expect(finalizeRecording).toHaveBeenCalledWith(
      { recordingId: 'rec-1', durationMs: 1_500 },
      signal,
    );
  });
});
