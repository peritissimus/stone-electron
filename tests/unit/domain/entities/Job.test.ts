import { describe, expect, it } from 'vitest';
import { JobEntity } from '../../../../src/main/domain/entities/Job';

const NOW = new Date('2026-06-19T12:00:00.000Z');
const BACKOFF = { baseMs: 1_000, maxMs: 60_000 };

function newJob(maxAttempts = 3) {
  return JobEntity.create({ id: 'j1', type: 'test', payload: { a: 1 }, maxAttempts, now: NOW });
}

describe('JobEntity', () => {
  it('creates a pending job runnable immediately', () => {
    const job = newJob();
    const p = job.toPersistence();
    expect(job.status).toBe('pending');
    expect(job.attempts).toBe(0);
    expect(p.runAfter).toEqual(NOW);
    expect(job.parsePayload()).toEqual({ a: 1 });
  });

  it('reschedules with exponential backoff on failure', () => {
    const job = newJob(5);

    const s1 = job.markFailed('boom', NOW, BACKOFF);
    expect(s1).toBe('pending');
    expect(job.attempts).toBe(1);
    // attempt 1 → base * 2^0 = 1000ms
    expect(job.toPersistence().runAfter.getTime()).toBe(NOW.getTime() + 1_000);

    const t2 = new Date(NOW.getTime() + 5_000);
    job.markFailed('boom', t2, BACKOFF);
    // attempt 2 → base * 2^1 = 2000ms
    expect(job.toPersistence().runAfter.getTime()).toBe(t2.getTime() + 2_000);
  });

  it('caps backoff at maxMs', () => {
    const job = newJob(20);
    for (let i = 0; i < 10; i++) job.markFailed('boom', NOW, BACKOFF);
    expect(job.toPersistence().runAfter.getTime()).toBe(NOW.getTime() + BACKOFF.maxMs);
  });

  it('marks the job dead once attempts are exhausted (no infinite retry)', () => {
    const job = newJob(3);
    expect(job.markFailed('e', NOW, BACKOFF)).toBe('pending');
    expect(job.markFailed('e', NOW, BACKOFF)).toBe('pending');
    expect(job.markFailed('e', NOW, BACKOFF)).toBe('dead');
    expect(job.status).toBe('dead');
    expect(job.attempts).toBe(3);
  });

  it('truncates oversized error strings', () => {
    const job = newJob(5);
    job.markFailed('x'.repeat(5_000), NOW, BACKOFF);
    expect(job.lastError?.length).toBe(2_000);
  });

  it('clears claim + error on success', () => {
    const job = newJob();
    job.markRunning(NOW);
    expect(job.toPersistence().claimedAt).toEqual(NOW);
    job.markSucceeded(NOW);
    expect(job.status).toBe('done');
    expect(job.toPersistence().claimedAt).toBeNull();
    expect(job.lastError).toBeNull();
  });

  it('counts a stale recovery as an attempt so toxic jobs still die', () => {
    const job = newJob(1);
    const status = job.recoverFromStale(NOW, BACKOFF);
    expect(status).toBe('dead');
    expect(job.attempts).toBe(1);
  });
});
