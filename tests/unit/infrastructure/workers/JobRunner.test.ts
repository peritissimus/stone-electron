import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobEntity } from '../../../../src/main/domain/entities/Job';
import type { IJobRepository } from '../../../../src/main/domain/ports/out/IJobRepository';
import { JobRunner } from '../../../../src/main/infrastructure/workers/JobRunner';
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
    for (const job of due) job.markRunning(now);
    return due;
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

function createRunner(repository = new InMemoryJobRepository()) {
  const span = {
    setAttribute: vi.fn(),
    recordError: vi.fn(),
    end: vi.fn(),
  };
  const runner = new JobRunner({
    repository,
    tracer: { startSpan: vi.fn(() => span) },
    idGenerator: { generate: vi.fn(() => 'job-1') },
    config: {
      minIdleMs: 5,
      maxIdleMs: 10,
      backoffBaseMs: 60_000,
      backoffMaxMs: 60_000,
      jobTimeoutMs: 60_000,
      pruneIntervalMs: 60_000,
      shutdownGraceMs: 100,
    },
  });
  return { repository, runner, span };
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

  it('recovers every running job on startup, including a freshly claimed one', async () => {
    const { repository, runner } = createRunner();
    const claimedAt = new Date();
    const orphan = JobEntity.create({
      id: 'orphan-1',
      type: 'test.orphan',
      now: claimedAt,
    });
    orphan.markRunning(claimedAt);
    repository.jobs.set(orphan.id, orphan);

    await runner.start();
    await runner.stop();

    expect(orphan.status).toBe('pending');
    expect(orphan.attempts).toBe(1);
  });
});

describe('meeting finalize job handler', () => {
  it('rejects malformed payloads before invoking the pipeline', async () => {
    const finalizeRecording = { execute: vi.fn() };
    const handler = createMeetingFinalizeJobHandler(finalizeRecording);

    await expect(
      handler(
        { recordingId: '', durationMs: -1, extra: true },
        { signal: new AbortController().signal, attempt: 1, jobId: 'job-1' },
      ),
    ).rejects.toThrow();
    expect(finalizeRecording.execute).not.toHaveBeenCalled();
    expect(MeetingFinalizeJobPayloadSchema.safeParse({ durationMs: 1 }).success).toBe(false);
  });

  it('passes validated payload and cancellation to the pipeline', async () => {
    const finalizeRecording = { execute: vi.fn().mockResolvedValue({ recording: {} }) };
    const handler = createMeetingFinalizeJobHandler(finalizeRecording);
    const signal = new AbortController().signal;

    await handler(
      { recordingId: 'rec-1', durationMs: 1_500 },
      { signal, attempt: 1, jobId: 'job-1' },
    );

    expect(finalizeRecording.execute).toHaveBeenCalledWith(
      { recordingId: 'rec-1', durationMs: 1_500 },
      { signal },
    );
  });
});
