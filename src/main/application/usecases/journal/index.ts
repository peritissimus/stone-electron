import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type {
  IJournalUseCases,
  OpenOrCreateJournalForDateRequest,
} from '../../../domain/ports/in/IJournalUseCases';
import { OpenOrCreateJournalForDateUseCase } from './OpenOrCreateJournalForDateUseCase';

export { OpenOrCreateJournalForDateUseCase };

export interface JournalUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

export function createJournalUseCases(deps: JournalUseCasesDeps): IJournalUseCases {
  const openOrCreate = new OpenOrCreateJournalForDateUseCase(
    deps.noteRepository,
    deps.workspaceRepository,
    deps.fileStorage,
  );

  return {
    openOrCreateForDate: (request: OpenOrCreateJournalForDateRequest) => openOrCreate.execute(request),
  };
}
