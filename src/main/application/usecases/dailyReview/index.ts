import type {
  IDailyReviewUseCases,
  IJournalUseCases,
  IMeetingRecordingRepository,
  INoteRepository,
  ITaskUseCases,
  ITextGenerator,
  IWorkspaceRepository,
} from '../../../domain';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { ICalendarSource } from '../../../domain/ports/out/ICalendarSource';
import type { IMailSource } from '../../../domain/ports/out/IMailSource';
import type { ILinearSource } from '../../../domain/ports/out/ILinearSource';
import { GetDailyReviewUseCase } from './GetDailyReviewUseCase';
import { SummarizeDailyReviewUseCase } from './SummarizeDailyReviewUseCase';

export { GetDailyReviewUseCase } from './GetDailyReviewUseCase';
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
}

export function createDailyReviewUseCases(deps: DailyReviewUseCasesDeps): IDailyReviewUseCases {
  const getDailyReview = new GetDailyReviewUseCase(deps);
  return {
    getDailyReview,
    summarizeDailyReview: new SummarizeDailyReviewUseCase({
      getDailyReview,
      textGenerator: deps.textGenerator,
      appendToJournal: deps.appendToJournal,
    }),
  };
}
