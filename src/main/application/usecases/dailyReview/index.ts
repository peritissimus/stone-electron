import type {
  IDailyReviewUseCases,
  IJournalUseCases,
  IMeetingRecordingRepository,
  INoteRepository,
  ITaskUseCases,
  ITextGenerator,
  IExternalSourceRegistry,
  IWorkspaceRepository,
} from '../../../domain';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { ICalendarSource } from '../../../domain/ports/out/ICalendarSource';
import type { IMailSource } from '../../../domain/ports/out/IMailSource';
import type { ILinearSource } from '../../../domain/ports/out/ILinearSource';
import { GetDailyReviewUseCase } from './GetDailyReviewUseCase';
import { LoadDailyReviewIntegrationUseCase } from './LoadDailyReviewIntegrationUseCase';
import { LoadDailyReviewIntegrationsUseCase } from './LoadDailyReviewIntegrationsUseCase';
import { ListDailyReviewCalendarsUseCase } from './ListDailyReviewCalendarsUseCase';
import { SummarizeDailyReviewUseCase } from './SummarizeDailyReviewUseCase';

export { GetDailyReviewUseCase } from './GetDailyReviewUseCase';
export { LoadDailyReviewIntegrationUseCase } from './LoadDailyReviewIntegrationUseCase';
export { LoadDailyReviewIntegrationsUseCase } from './LoadDailyReviewIntegrationsUseCase';
export { ListDailyReviewCalendarsUseCase } from './ListDailyReviewCalendarsUseCase';
export { SummarizeDailyReviewUseCase } from './SummarizeDailyReviewUseCase';

export interface DailyReviewUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  meetingRepository: IMeetingRecordingRepository;
  journalUseCases: IJournalUseCases;
  taskUseCases: ITaskUseCases;
  appConfigRepository: IAppConfigRepository;
  textGenerator: ITextGenerator;
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
  calendarSource?: ICalendarSource;
  mailSource?: IMailSource;
  linearSource?: ILinearSource;
  externalSourceRegistry: IExternalSourceRegistry;
}

export function createDailyReviewUseCases(deps: DailyReviewUseCasesDeps): IDailyReviewUseCases {
  const getDailyReview = new GetDailyReviewUseCase(deps);
  const loadIntegration = new LoadDailyReviewIntegrationUseCase(deps);
  return {
    getDailyReview,
    listCalendars: new ListDailyReviewCalendarsUseCase(deps.calendarSource),
    loadIntegration,
    loadIntegrations: new LoadDailyReviewIntegrationsUseCase(deps.externalSourceRegistry),
    summarizeDailyReview: new SummarizeDailyReviewUseCase({
      getDailyReview,
      textGenerator: deps.textGenerator,
      appendToJournal: deps.appendToJournal,
    }),
  };
}
