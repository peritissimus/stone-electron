/**
 * Database Use Cases Port
 *
 * Defines the contract for database maintenance operations.
 */
import { Context } from 'effect';
import type { Effect } from 'effect';

export interface DatabaseStatusResponse {
  /** Absolute path to the SQLite file. */
  path: string;
  /** On-disk size of the SQLite file in bytes. Alias: `databaseSize` on the wire. */
  databaseSize: number;
  /** Whether the DB handle is currently open. */
  isOpen: boolean;
  /** Row counts for the primary content tables. */
  noteCount: number;
  notebookCount: number;
  tagCount: number;
}

export interface VacuumDatabaseResponse {
  /** Database file size in bytes immediately before VACUUM ran. */
  size_before: number;
  /** Database file size in bytes immediately after VACUUM ran. */
  size_after: number;
  /** `size_before - size_after`, clamped to >= 0. */
  freed_bytes: number;
}

export interface DatabaseIntegrityResponse {
  ok: boolean;
  errors: string[];
}

export interface IGetDatabaseStatusUseCase {
  execute(): Effect.Effect<DatabaseStatusResponse, Error>;
}

export interface IVacuumDatabaseUseCase {
  execute(): Effect.Effect<VacuumDatabaseResponse, Error>;
}

export interface ICheckDatabaseIntegrityUseCase {
  execute(): Effect.Effect<DatabaseIntegrityResponse, Error>;
}

/**
 * Aggregated database use cases interface for DI container
 */
export interface IDatabaseUseCases {
  getStatus: IGetDatabaseStatusUseCase;
  vacuum: IVacuumDatabaseUseCase;
  checkIntegrity: ICheckDatabaseIntegrityUseCase;
}

export const DatabaseUseCasesPort =
  Context.GenericTag<IDatabaseUseCases>('stone/IDatabaseUseCases');
