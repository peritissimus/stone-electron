import type {
  IDailyReviewUseCases,
  IJournalUseCases,
  IMeetingRecordingRepository,
  INoteRepository,
  ITaskUseCases,
  IWorkspaceRepository,
} from '../../../domain';
import { GetDailyReviewUseCase } from './GetDailyReviewUseCase';

export { GetDailyReviewUseCase } from './GetDailyReviewUseCase';

export interface DailyReviewUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  meetingRepository: IMeetingRecordingRepository;
  journalUseCases: IJournalUseCases;
  taskUseCases: ITaskUseCases;
}

export function createDailyReviewUseCases(
  deps: DailyReviewUseCasesDeps,
): IDailyReviewUseCases {
  return {
    getDailyReview: new GetDailyReviewUseCase(deps),
  };
}
