import type {
  IGetDatabaseStatusUseCase,
  DatabaseStatusResponse,
} from '../../../domain/ports/in/IDatabaseUseCases';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { INotebookRepository } from '../../../domain/ports/out/INotebookRepository';
import type { ITagRepository } from '../../../domain/ports/out/ITagRepository';
import type { DatabaseManager } from './types';

export interface GetDatabaseStatusDeps {
  getDatabaseManager: () => DatabaseManager;
  noteRepository: INoteRepository;
  notebookRepository: INotebookRepository;
  tagRepository: ITagRepository;
}

export class GetDatabaseStatusUseCase implements IGetDatabaseStatusUseCase {
  constructor(private readonly deps: GetDatabaseStatusDeps) {}

  async execute(): Promise<DatabaseStatusResponse> {
    const { getDatabaseManager, noteRepository, notebookRepository, tagRepository } = this.deps;
    const db = getDatabaseManager();

    const [raw, noteCount, notebookCount, allTags] = await Promise.all([
      db.getStatus(),
      noteRepository.count(),
      notebookRepository.count(),
      tagRepository.findAll(),
    ]);

    return {
      path: raw.path,
      databaseSize: raw.size,
      isOpen: raw.isOpen,
      noteCount,
      notebookCount,
      tagCount: allTags.length,
    };
  }
}
