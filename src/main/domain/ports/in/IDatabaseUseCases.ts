/**
 * Database Use Cases Port
 *
 * Defines the contract for database maintenance operations.
 */

export interface DatabaseStatusResponse {
  path: string;
  size: number;
  isOpen: boolean;
}

export interface DatabaseIntegrityResponse {
  ok: boolean;
  errors: string[];
}

export interface IGetDatabaseStatusUseCase {
  execute(): Promise<DatabaseStatusResponse>;
}

export interface IVacuumDatabaseUseCase {
  execute(): Promise<void>;
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
