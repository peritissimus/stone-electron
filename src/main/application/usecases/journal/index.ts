import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IJournalReader } from '../../../domain/ports/out/IJournalReader';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type {
  IJournalUseCases,
  ListJournalRangeRequest,
  OpenOrCreateJournalForDateRequest,
} from '../../../domain/ports/in/IJournalUseCases';
import { OpenOrCreateJournalForDateUseCase } from './OpenOrCreateJournalForDateUseCase';
import { ListJournalRangeUseCase } from './ListJournalRangeUseCase';

export { OpenOrCreateJournalForDateUseCase };
export { ListJournalRangeUseCase };

export interface JournalUseCasesDeps {
  noteRepository: INoteRepository;
  journalReader: IJournalReader;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  appConfigRepository: IAppConfigRepository;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  eventPublisher?: IEventPublisher;
}

export function createJournalUseCases(deps: JournalUseCasesDeps): IJournalUseCases {
  const openOrCreate = new OpenOrCreateJournalForDateUseCase(
    deps.noteRepository,
    deps.workspaceRepository,
    deps.fileStorage,
    deps.appConfigRepository,
    deps.idGenerator,
    deps.pathService,
    deps.eventPublisher,
  );
  const listRange = new ListJournalRangeUseCase(
    deps.journalReader,
    deps.workspaceRepository,
    deps.appConfigRepository,
  );

  return {
    openOrCreateForDate: (request: OpenOrCreateJournalForDateRequest) =>
      openOrCreate.execute(request),
    listRange: (request: ListJournalRangeRequest) => listRange.execute(request),
  };
}
