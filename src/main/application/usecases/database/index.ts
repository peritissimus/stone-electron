import type { IDatabaseUseCases } from '../../../domain/ports/in/IDatabaseUseCases';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { INotebookRepository } from '../../../domain/ports/out/INotebookRepository';
import type { ITagRepository } from '../../../domain/ports/out/ITagRepository';
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
  noteRepository: INoteRepository;
  notebookRepository: INotebookRepository;
  tagRepository: ITagRepository;
}

export function createDatabaseUseCases(deps: DatabaseUseCasesDeps): IDatabaseUseCases {
  const { getDatabaseManager, noteRepository, notebookRepository, tagRepository } = deps;

  return {
    getStatus: new GetDatabaseStatusUseCase({
      getDatabaseManager,
      noteRepository,
      notebookRepository,
      tagRepository,
    }),
    vacuum: new VacuumDatabaseUseCase(getDatabaseManager),
    checkIntegrity: new CheckDatabaseIntegrityUseCase(getDatabaseManager),
  };
}
