import type { IDatabaseUseCases } from '../../../domain/ports/in/IDatabaseUseCases';
import type { DatabaseManager } from './types';
import { GetDatabaseStatusUseCase } from './GetDatabaseStatusUseCase';
import { VacuumDatabaseUseCase } from './VacuumDatabaseUseCase';
import { CheckDatabaseIntegrityUseCase } from './CheckDatabaseIntegrityUseCase';

export type { DatabaseManager } from './types';
export { GetDatabaseStatusUseCase } from './GetDatabaseStatusUseCase';
export { VacuumDatabaseUseCase } from './VacuumDatabaseUseCase';
export { CheckDatabaseIntegrityUseCase } from './CheckDatabaseIntegrityUseCase';

export interface DatabaseUseCasesDeps {
  getDatabaseManager: () => DatabaseManager;
}

export function createDatabaseUseCases(deps: DatabaseUseCasesDeps): IDatabaseUseCases {
  const { getDatabaseManager } = deps;

  return {
    getStatus: new GetDatabaseStatusUseCase(getDatabaseManager),
    vacuum: new VacuumDatabaseUseCase(getDatabaseManager),
    checkIntegrity: new CheckDatabaseIntegrityUseCase(getDatabaseManager),
  };
}
