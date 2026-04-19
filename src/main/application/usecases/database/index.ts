import type { IDatabaseUseCases } from '../../../domain/ports/in/IDatabaseUseCases';
import { GetDatabaseStatusUseCase, type DatabaseManager } from './GetDatabaseStatusUseCase';
import { VacuumDatabaseUseCase } from './VacuumDatabaseUseCase';
import { CheckDatabaseIntegrityUseCase } from './CheckDatabaseIntegrityUseCase';

export { GetDatabaseStatusUseCase, type DatabaseManager } from './GetDatabaseStatusUseCase';
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
