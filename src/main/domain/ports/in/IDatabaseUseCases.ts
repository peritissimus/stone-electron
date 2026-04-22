/**
 * Database Use Cases Port
 *
 * Defines the contract for database maintenance operations.
 */

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
  execute(): Promise<DatabaseStatusResponse>;
}

export interface IVacuumDatabaseUseCase {
  execute(): Promise<VacuumDatabaseResponse>;
}

export interface ICheckDatabaseIntegrityUseCase {
  execute(): Promise<DatabaseIntegrityResponse>;
}

/**
 * Aggregated database use cases interface for DI container
 */
export interface IDatabaseUseCases {
  getStatus: IGetDatabaseStatusUseCase;
  vacuum: IVacuumDatabaseUseCase;
  checkIntegrity: ICheckDatabaseIntegrityUseCase;
}
