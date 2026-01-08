/**
 * Database Use Cases Port
 *
 * Defines the contract for database maintenance operations.
 */

// Request/Response types
export interface DatabaseStatusResponse {
  databaseSize: number;
  databasePath: string;
  isMigrating: boolean;
  vectorSize: number;
  lastBackup?: Date;
  lastDefrag?: Date;
}

export interface VacuumResponse {
  success: boolean;
  sizeBefore: number;
  sizeAfter: number;
  freedBytes: number;
}

export interface IntegrityCheckRequest {
  detailed?: boolean;
}

export interface IntegrityCheckResponse {
  ok: boolean;
  foreignKeysOk: boolean;
  errors: string[];
  warnings: string[];
}

// Use case interfaces
export interface IGetDatabaseStatusUseCase {
  execute(): Promise<DatabaseStatusResponse>;
}

export interface IVacuumDatabaseUseCase {
  execute(): Promise<VacuumResponse>;
}

export interface ICheckDatabaseIntegrityUseCase {
  execute(request: IntegrityCheckRequest): Promise<IntegrityCheckResponse>;
}
