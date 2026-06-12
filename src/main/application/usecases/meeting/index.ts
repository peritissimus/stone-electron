import type {
  IFileStorage,
  IIdGenerator,
  IMeetingRecordingRepository,
  IMeetingUseCases,
  IPathService,
  ISummarizationStrategy,
  ISystemAudioTap,
  ITranscriber,
  IWorkspaceRepository,
} from '../../../domain';
import { AppendRecordingAudioUseCase } from './AppendRecordingAudioUseCase';
import { DeleteMeetingRecordingUseCase } from './DeleteMeetingRecordingUseCase';
import { FinalizeRecordingUseCase } from './FinalizeRecordingUseCase';
import { GetMeetingRecordingUseCase } from './GetMeetingRecordingUseCase';
import { ListMeetingRecordingsUseCase } from './ListMeetingRecordingsUseCase';
import { ReserveRecordingSlotUseCase } from './ReserveRecordingSlotUseCase';
import { ResummarizeMeetingUseCase } from './ResummarizeMeetingUseCase';
import { SendToJournalUseCase } from './SendToJournalUseCase';

export { AppendRecordingAudioUseCase } from './AppendRecordingAudioUseCase';
export { DeleteMeetingRecordingUseCase } from './DeleteMeetingRecordingUseCase';
export { FinalizeRecordingUseCase } from './FinalizeRecordingUseCase';
export { GetMeetingRecordingUseCase } from './GetMeetingRecordingUseCase';
export { ListMeetingRecordingsUseCase } from './ListMeetingRecordingsUseCase';
export { ReserveRecordingSlotUseCase, RECORDINGS_DIR } from './ReserveRecordingSlotUseCase';
export { ResummarizeMeetingUseCase } from './ResummarizeMeetingUseCase';
export { SendToJournalUseCase } from './SendToJournalUseCase';

export interface MeetingUseCasesDeps {
  meetingRepository: IMeetingRecordingRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  transcriber: ITranscriber;
  summarizer: ISummarizationStrategy;
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
  systemAudioTap?: ISystemAudioTap;
  defaultPrompt?: string;
}

export function createMeetingUseCases(deps: MeetingUseCasesDeps): IMeetingUseCases {
  return {
    reserveRecordingSlot: new ReserveRecordingSlotUseCase(
      deps.meetingRepository,
      deps.workspaceRepository,
      deps.fileStorage,
      deps.idGenerator,
      deps.pathService,
      deps.systemAudioTap,
    ),
    appendRecordingAudio: new AppendRecordingAudioUseCase(
      deps.meetingRepository,
      deps.workspaceRepository,
      deps.fileStorage,
      deps.pathService,
    ),
    finalizeRecording: new FinalizeRecordingUseCase({
      meetingRepository: deps.meetingRepository,
      workspaceRepository: deps.workspaceRepository,
      fileStorage: deps.fileStorage,
      pathService: deps.pathService,
      transcriber: deps.transcriber,
      summarizer: deps.summarizer,
      systemAudioTap: deps.systemAudioTap,
      defaultPrompt: deps.defaultPrompt,
    }),
    listMeetingRecordings: new ListMeetingRecordingsUseCase(
      deps.meetingRepository,
      deps.workspaceRepository,
    ),
    getMeetingRecording: new GetMeetingRecordingUseCase(deps.meetingRepository),
    deleteMeetingRecording: new DeleteMeetingRecordingUseCase(
      deps.meetingRepository,
      deps.workspaceRepository,
      deps.fileStorage,
      deps.pathService,
      deps.systemAudioTap,
    ),
    resummarizeMeeting: new ResummarizeMeetingUseCase({
      meetingRepository: deps.meetingRepository,
      summarizer: deps.summarizer,
      defaultPrompt: deps.defaultPrompt,
    }),
    sendToJournal: new SendToJournalUseCase({
      meetingRepository: deps.meetingRepository,
      appendToJournal: deps.appendToJournal,
    }),
  };
}
