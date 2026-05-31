import type {
  IJournalUseCases,
  IMeetingRecordingRepository,
  INoteRepository,
  IStatusReportUseCases,
  ITaskUseCases,
  ITextGenerator,
  IWorkspaceRepository,
} from '../../../domain';
import { GenerateStatusReportUseCase } from './GenerateStatusReportUseCase';

export { GenerateStatusReportUseCase } from './GenerateStatusReportUseCase';

export interface StatusReportUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  meetingRepository: IMeetingRecordingRepository;
  journalUseCases: IJournalUseCases;
  taskUseCases: ITaskUseCases;
  textGenerator: ITextGenerator;
}

export function createStatusReportUseCases(
  deps: StatusReportUseCasesDeps,
): IStatusReportUseCases {
  return {
    generate: new GenerateStatusReportUseCase(deps),
  };
}
