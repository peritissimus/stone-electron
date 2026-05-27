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
  type IFileStorage,
  type IMeetingRecordingRepository,
  type IPathService,
  type ISummarizationStrategy,
  type ITranscriber,
  type IWorkspaceRepository,
} from '../../../domain';
import type {
  IFinalizeRecordingUseCase,
  FinalizeRecordingRequest,
  FinalizeRecordingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

export interface FinalizeRecordingUseCaseDeps {
  meetingRepository: IMeetingRecordingRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  pathService: IPathService;
  transcriber: ITranscriber;
  summarizer: ISummarizationStrategy;
  /** Override for tests / future settings. */
  defaultPrompt?: string;
}

export class FinalizeRecordingUseCase implements IFinalizeRecordingUseCase {
  constructor(private readonly deps: FinalizeRecordingUseCaseDeps) {}

  async execute(request: FinalizeRecordingRequest): Promise<FinalizeRecordingResponse> {
    const recording = await this.deps.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);
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

    try {
      recording.markTranscribing();
      await this.deps.meetingRepository.save(recording);

      const transcript = await this.deps.transcriber.transcribe({ audioPath: audioAbsolutePath });
      // Use the captured duration if Whisper's report is suspiciously low.
      const durationMs = Math.max(transcript.durationMs, request.durationMs);
      recording.attachTranscript(transcript.text, transcript.segments, durationMs);
      await this.deps.meetingRepository.save(recording);

      const summary = await this.deps.summarizer.summarize({
        transcript: transcript.text,
        promptTemplate: prompt,
      });
      recording.attachSummary(summary.summary, summary.promptUsed);
      await this.deps.meetingRepository.save(recording);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recording.markFailed(message);
      await this.deps.meetingRepository.save(recording);
      return { recording: recording.toPersistence() };
    }

    // Pipeline succeeded — delete the audio file and drop the path.
    // Failure here is non-fatal: the orphan can be cleaned up later.
    try {
      await this.deps.fileStorage.delete(audioAbsolutePath);
      recording.clearAudio();
      await this.deps.meetingRepository.save(recording);
    } catch {
      // intentional swallow — audio cleanup is best-effort.
    }

    return { recording: recording.toPersistence() };
  }
}
