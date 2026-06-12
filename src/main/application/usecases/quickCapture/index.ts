import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { ITranscriber } from '../../../domain/ports/out/ITranscriber';
import type { IQuickCaptureUseCases } from '../../../domain/ports/in/IQuickCaptureUseCases';
import { AppendToJournalUseCase } from './AppendToJournalUseCase';
import { TranscribeVoiceCaptureUseCase } from './TranscribeVoiceCaptureUseCase';

export { AppendToJournalUseCase } from './AppendToJournalUseCase';
export { TranscribeVoiceCaptureUseCase } from './TranscribeVoiceCaptureUseCase';

export interface QuickCaptureUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  appConfigRepository: IAppConfigRepository;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  transcriber: ITranscriber;
  eventPublisher?: IEventPublisher;
}

export function createQuickCaptureUseCases(deps: QuickCaptureUseCasesDeps): IQuickCaptureUseCases {
  const {
    noteRepository,
    workspaceRepository,
    fileStorage,
    appConfigRepository,
    idGenerator,
    pathService,
    transcriber,
    eventPublisher,
  } = deps;

  const appendToJournalUseCase = new AppendToJournalUseCase(
    noteRepository,
    workspaceRepository,
    fileStorage,
    appConfigRepository,
    idGenerator,
    pathService,
    eventPublisher,
  );

  const transcribeVoiceCaptureUseCase = new TranscribeVoiceCaptureUseCase(
    workspaceRepository,
    fileStorage,
    pathService,
    idGenerator,
    transcriber,
  );

  return {
    appendToJournal: (content: string, workspaceId?: string) =>
      appendToJournalUseCase.execute(content, workspaceId),
    transcribeVoiceCapture: (request) => transcribeVoiceCaptureUseCase.execute(request),
  };
}
