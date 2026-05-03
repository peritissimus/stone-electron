import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type {
  IQuickNoteUseCases,
  CreateQuickNoteRequest,
} from '../../../domain/ports/in/IQuickNoteUseCases';
import { CreateQuickNoteUseCase } from './CreateQuickNoteUseCase';

export { CreateQuickNoteUseCase };

export interface QuickNoteUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  appConfigRepository: IAppConfigRepository;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  eventPublisher?: IEventPublisher;
}

export function createQuickNoteUseCases(deps: QuickNoteUseCasesDeps): IQuickNoteUseCases {
  const createQuickNote = new CreateQuickNoteUseCase(
    deps.noteRepository,
    deps.workspaceRepository,
    deps.fileStorage,
    deps.appConfigRepository,
    deps.idGenerator,
    deps.pathService,
    deps.eventPublisher,
  );

  return {
    createInSlot: (request: CreateQuickNoteRequest) => createQuickNote.execute(request),
  };
}
