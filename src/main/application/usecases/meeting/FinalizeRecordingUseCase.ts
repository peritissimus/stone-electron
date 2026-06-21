/**
 * FinalizeRecordingUseCase — drives the post-capture pipeline:
 *   transcribe → summarize → persist transcript+summary → delete audio.
 *
 * Per the agreed UX the journal is NOT touched here — the user reviews
 * the summary on the Meetings page and explicitly clicks "Send to
 * journal", which routes through SendToJournalUseCase.
 *
 * State machine errors leave status='failed' with `error` set and the
 * audio file intact so the user can retry from the management page.
 */

import {
  DEFAULT_MEETING_SUMMARY_PROMPT,
  MeetingRecordingNotFoundError,
  type IAppConfigRepository,
  type IEchoCanceller,
  type IEventPublisher,
  type IFileStorage,
  type IMeetingRecordingRepository,
  type IPathService,
  type ISummarizationStrategy,
  type ITranscriber,
  type IWorkspaceRepository,
} from '../../../domain';
import {
  systemTrackPath,
  type IFinalizeRecordingUseCase,
  type FinalizeRecordingRequest,
  type FinalizeRecordingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';
import { deleteRecordingAudioFiles } from './meetingAudioCleanup';
import { reprocessRecordingAudio, publishMeetingStatus } from './meetingReprocess';

export interface FinalizeRecordingUseCaseDeps {
  meetingRepository: IMeetingRecordingRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  pathService: IPathService;
  transcriber: ITranscriber;
  summarizer: ISummarizationStrategy;
  appConfigRepository: IAppConfigRepository;
  /** Pushes recording status to the renderer during the async pipeline. */
  eventPublisher: IEventPublisher;
  /** Optional — cancels speaker bleed from the mic using the system track as
   *  the reference before transcription. Best-effort: skipped on failure. */
  echoCanceller?: IEchoCanceller;
  /** Override for tests / future settings. */
  defaultPrompt?: string;
}

export class FinalizeRecordingUseCase implements IFinalizeRecordingUseCase {
  constructor(private readonly deps: FinalizeRecordingUseCaseDeps) {}

  async execute(request: FinalizeRecordingRequest): Promise<FinalizeRecordingResponse> {
    const recording = await this.deps.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);

    // Idempotency: this runs as a durable job, so it may be re-delivered (a
    // retry, or recovery after a crash that finished the work but didn't mark
    // the job done). If it's already finalized, do nothing — never re-run the
    // expensive transcription/summarization.
    if (recording.status === 'ready') {
      return { recording: recording.toPersistence() };
    }

    if (!recording.audioPath) {
      throw new Error(`Recording ${request.recordingId} has no audio path`);
    }

    const workspace = await this.deps.workspaceRepository.findById(recording.workspaceId);
    if (!workspace) throw new Error(`Workspace ${recording.workspaceId} no longer exists`);
    const audioAbsolutePath = this.deps.pathService.join(
      workspace.folderPath,
      recording.audioPath,
    );

    const prompt = this.deps.defaultPrompt ?? DEFAULT_MEETING_SUMMARY_PROMPT;
    const systemAbsolutePath = this.deps.pathService.join(
      workspace.folderPath,
      systemTrackPath(recording.audioPath),
    );

    try {
      await reprocessRecordingAudio(
        this.deps,
        recording,
        audioAbsolutePath,
        systemAbsolutePath,
        prompt,
        request.durationMs,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recording.markFailed(message);
      await this.deps.meetingRepository.save(recording);
      publishMeetingStatus(this.deps.eventPublisher, recording);
      return { recording: recording.toPersistence() };
    }

    // Retention: when the user picks "delete after transcribing" (-1), drop
    // the audio now that transcript + summary exist. Other settings (0 = keep,
    // N = keep N days) leave the audio for replay / re-transcribe; the startup
    // PruneRecordingAudioUseCase enforces the N-day window. Best-effort — a
    // failed cleanup never fails finalize.
    const config = await this.deps.appConfigRepository.get();
    if (config.meetings.audioRetentionDays === -1 && recording.audioPath) {
      await deleteRecordingAudioFiles(
        { fileStorage: this.deps.fileStorage, pathService: this.deps.pathService },
        workspace.folderPath,
        recording.audioPath,
      );
      recording.clearAudio();
      await this.deps.meetingRepository.save(recording);
      publishMeetingStatus(this.deps.eventPublisher, recording);
    }

    return { recording: recording.toPersistence() };
  }
}
