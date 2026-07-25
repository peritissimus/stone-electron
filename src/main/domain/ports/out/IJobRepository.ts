/**
 * IJobRepository — persistence port for the durable background-job queue.
 *
 * Implemented by an adapter (JobRepository). The JobRunner worker drives it:
 * claims due work, persists results, recovers crash-orphaned rows, and prunes
 * terminal rows on a retention sweep.
 */

import type { JobEntity } from '../../entities/Job';

export interface IJobRepository {
  /** Insert or update a job (upsert by id). */
  save(job: JobEntity): Promise<void>;

  /**
   * Atomically claim up to `limit` pending jobs whose `runAfter <= now`,
   * marking them `running` (so a second claim can't take them), and return the
   * claimed entities. Ordered by `runAfter` ascending.
   */
  claimDue(now: Date, limit: number): Promise<JobEntity[]>;

  /** All jobs left `running`; on startup they belong to the previous process. */
  findRunning(): Promise<JobEntity[]>;

  /**
   * Delete terminal jobs (`done` / `dead`) last updated before `cutoff`.
   * Returns the number of rows removed. Keeps the table from growing forever.
   */
  pruneTerminal(cutoff: Date): Promise<number>;

  findById(id: string): Promise<JobEntity | null>;
}
