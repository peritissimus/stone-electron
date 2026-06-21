/**
 * JobRepository — drizzle/libSQL-backed persistence for the durable job queue.
 *
 * `claimDue` runs in a transaction so claiming and flipping rows to `running`
 * is atomic (a job can't be picked up twice). Payload is an opaque JSON TEXT
 * column owned by the producer/handler, not queried structurally.
 */

import { and, asc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import { jobs, type Database } from '../../../shared';
import { JobEntity, type JobProps, type JobStatus } from '../../../domain';
import type { IJobRepository } from '../../../domain/ports/out/IJobRepository';
import { handleOperation } from '../../../shared/utils';

export interface JobRepositoryDeps {
  db: Database;
}

type JobRow = typeof jobs.$inferSelect;

const TERMINAL: JobStatus[] = ['done', 'dead'];

export class JobRepository implements IJobRepository {
  constructor(private deps: JobRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'JobRepository', operation, context });
  }

  async save(job: JobEntity): Promise<void> {
    return this.handle(
      'save',
      async () => {
        const p = job.toPersistence();
        const row = toRow(p);
        await this.deps.db
          .insert(jobs)
          .values(row)
          .onConflictDoUpdate({
            target: jobs.id,
            set: {
              type: row.type,
              payload: row.payload,
              status: row.status,
              attempts: row.attempts,
              maxAttempts: row.maxAttempts,
              runAfter: row.runAfter,
              claimedAt: row.claimedAt,
              lastError: row.lastError,
              updatedAt: row.updatedAt,
            },
          });
      },
      { jobId: job.id, type: job.type },
    );
  }

  async claimDue(now: Date, limit: number): Promise<JobEntity[]> {
    return this.handle(
      'claimDue',
      async () => {
        if (limit <= 0) return [];
        return this.deps.db.transaction(async (tx) => {
          const due = await tx
            .select()
            .from(jobs)
            .where(and(eq(jobs.status, 'pending'), lte(jobs.runAfter, now)))
            .orderBy(asc(jobs.runAfter))
            .limit(limit);

          if (due.length === 0) return [];

          const ids = due.map((r) => r.id);
          await tx
            .update(jobs)
            .set({ status: 'running', claimedAt: now, updatedAt: now })
            .where(inArray(jobs.id, ids));

          // Return entities reflecting the just-applied running state.
          return due.map((r) =>
            JobEntity.fromPersistence({
              ...toProps(r),
              status: 'running',
              claimedAt: now,
              updatedAt: now,
            }),
          );
        });
      },
      { limit },
    );
  }

  async findStaleRunning(staleBefore: Date): Promise<JobEntity[]> {
    return this.handle('findStaleRunning', async () => {
      const rows = await this.deps.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.status, 'running'), lt(jobs.claimedAt, staleBefore)));
      return rows.map((r) => JobEntity.fromPersistence(toProps(r)));
    });
  }

  async pruneTerminal(cutoff: Date): Promise<number> {
    return this.handle(
      'pruneTerminal',
      async () => {
        const res = await this.deps.db
          .delete(jobs)
          .where(and(inArray(jobs.status, TERMINAL), lt(jobs.updatedAt, cutoff)));
        return res.rowsAffected ?? 0;
      },
      { cutoff: cutoff.toISOString() },
    );
  }

  async countByStatus(): Promise<Record<JobStatus, number>> {
    return this.handle('countByStatus', async () => {
      const rows = await this.deps.db
        .select({ status: jobs.status, count: sql<number>`count(*)` })
        .from(jobs)
        .groupBy(jobs.status);
      const counts: Record<JobStatus, number> = { pending: 0, running: 0, done: 0, dead: 0 };
      for (const r of rows) {
        if (r.status in counts) counts[r.status as JobStatus] = Number(r.count);
      }
      return counts;
    });
  }

  async findById(id: string): Promise<JobEntity | null> {
    return this.handle(
      'findById',
      async () => {
        const rows = await this.deps.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
        return rows[0] ? JobEntity.fromPersistence(toProps(rows[0])) : null;
      },
      { jobId: id },
    );
  }
}

function toProps(row: JobRow): JobProps {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    status: row.status as JobStatus,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAfter: row.runAfter,
    claimedAt: row.claimedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(p: JobProps): typeof jobs.$inferInsert {
  return {
    id: p.id,
    type: p.type,
    payload: p.payload,
    status: p.status,
    attempts: p.attempts,
    maxAttempts: p.maxAttempts,
    runAfter: p.runAfter,
    claimedAt: p.claimedAt,
    lastError: p.lastError,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
