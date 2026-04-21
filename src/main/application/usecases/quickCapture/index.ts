import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IQuickCaptureUseCases } from '../../../domain/ports/in/IQuickCaptureUseCases';
import { AppendToJournalUseCase } from './AppendToJournalUseCase';

export { AppendToJournalUseCase } from './AppendToJournalUseCase';

export interface QuickCaptureUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  appConfigRepository: IAppConfigRepository;
}

export function createQuickCaptureUseCases(deps: QuickCaptureUseCasesDeps): IQuickCaptureUseCases {
  const { noteRepository, workspaceRepository, fileStorage, appConfigRepository } = deps;

  const appendToJournalUseCase = new AppendToJournalUseCase(
    noteRepository,
    workspaceRepository,
    fileStorage,
    appConfigRepository,
  );

  return {
    appendToJournal: (content: string, workspaceId?: string) =>
      appendToJournalUseCase.execute(content, workspaceId),
  };
}
