import type {
  IDailyReviewUseCases,
  IJournalUseCases,
  IMeetingRecordingRepository,
  INoteRepository,
  ITaskUseCases,
  IWorkspaceRepository,
} from '../../../domain';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import { GetDailyReviewUseCase } from './GetDailyReviewUseCase';

export { GetDailyReviewUseCase } from './GetDailyReviewUseCase';

export interface DailyReviewUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  meetingRepository: IMeetingRecordingRepository;
  journalUseCases: IJournalUseCases;
  taskUseCases: ITaskUseCases;
  appConfigRepository: IAppConfigRepository;
}

export function createDailyReviewUseCases(
  deps: DailyReviewUseCasesDeps,
): IDailyReviewUseCases {
  return {
    getDailyReview: new GetDailyReviewUseCase(deps),
  };
}
