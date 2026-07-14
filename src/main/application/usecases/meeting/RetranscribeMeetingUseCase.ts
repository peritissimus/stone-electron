/**
 * RetranscribeMeetingUseCase — re-run the transcription + summarization pipeline
 * on a recording whose audio is still on disk. Lets the user reprocess after a
 * model upgrade (or a failed first pass) without re-recording. Requires the
 * audio to still exist (governed by the retention setting).
 */

import {
  DEFAULT_MEETING_SUMMARY_PROMPT,
  MeetingRecordingNotFoundError,
  type IPathService,
  type IWorkspaceRepository,
} from '../../../domain';
import {
  systemTrackPath,
  type IRetranscribeMeetingUseCase,
  type RetranscribeMeetingRequest,
  type RetranscribeMeetingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';
import {
  reprocessRecordingAudio,
  publishMeetingStatus,
  type MeetingReprocessDeps,
} from './meetingReprocess';

export interface RetranscribeMeetingUseCaseDeps extends MeetingReprocessDeps {
  workspaceRepository: IWorkspaceRepository;
  pathService: IPathService;
  defaultPrompt?: string;
}

export class RetranscribeMeetingUseCase implements IRetranscribeMeetingUseCase {
  constructor(private readonly deps: RetranscribeMeetingUseCaseDeps) {}

  async execute(request: RetranscribeMeetingRequest): Promise<RetranscribeMeetingResponse> {
    const recording = await this.deps.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);
    if (!recording.audioPath) {
      throw new Error("This recording's audio was deleted, so it can't be re-transcribed.");
    }

    const workspace = await this.deps.workspaceRepository.findById(recording.workspaceId);
    if (!workspace) throw new Error(`Workspace ${recording.workspaceId} no longer exists`);

    const audioAbsolutePath = this.deps.pathService.join(workspace.folderPath, recording.audioPath);
    if (!(await this.deps.fileStorage.exists(audioAbsolutePath))) {
      throw new Error("This recording's audio file is missing, so it can't be re-transcribed.");
    }
    const systemAbsolutePath = this.deps.pathService.join(
      workspace.folderPath,
      systemTrackPath(recording.audioPath),
    );
    const prompt = this.deps.defaultPrompt ?? DEFAULT_MEETING_SUMMARY_PROMPT;

    try {
      // requestDurationMs 0 — the freshly transcribed length is authoritative.
      await reprocessRecordingAudio(this.deps, recording, audioAbsolutePath, systemAbsolutePath, prompt, 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recording.markFailed(message);
      await this.deps.meetingRepository.save(recording);
      publishMeetingStatus(this.deps.eventPublisher, recording);
    }

    return { recording: recording.toPersistence() };
  }
}
