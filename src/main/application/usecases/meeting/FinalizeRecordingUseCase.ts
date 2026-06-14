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
  type IEchoCanceller,
  type IFileStorage,
  type IMeetingRecordingRepository,
  type IPathService,
  type ISummarizationStrategy,
  type ITranscriber,
  type IWorkspaceRepository,
  type TranscriptSegment,
} from '../../../domain';
import {
  systemTrackPath,
  type IFinalizeRecordingUseCase,
  type FinalizeRecordingRequest,
  type FinalizeRecordingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

export interface FinalizeRecordingUseCaseDeps {
  meetingRepository: IMeetingRecordingRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  pathService: IPathService;
  transcriber: ITranscriber;
  summarizer: ISummarizationStrategy;
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
      recording.markTranscribing();
      await this.deps.meetingRepository.save(recording);

      const hasSystemTrack = await this.deps.fileStorage.exists(systemAbsolutePath);

      // Cancel speaker echo from the mic before transcription: on speakers the
      // system audio bleeds into the mic and pollutes the "You" track. The
      // system track is the clean reference, so AEC subtracts it. Best-effort —
      // on any failure we fall back to the raw mic.
      const micForTranscription = hasSystemTrack
        ? await this.cancelEcho(audioAbsolutePath, systemAbsolutePath)
        : audioAbsolutePath;

      // Transcribe mic and system tracks separately so each segment keeps its
      // source — clean "You" vs "Others" attribution without acoustic guessing.
      const micResult = await this.deps.transcriber.transcribe({ audioPath: micForTranscription });
      const segments: TranscriptSegment[] = micResult.segments.map((s) => ({
        ...s,
        source: 'mic' as const,
      }));
      let maxDurationMs = micResult.durationMs;

      if (micForTranscription !== audioAbsolutePath) {
        await this.deps.fileStorage.delete(micForTranscription).catch(() => {});
      }

      if (hasSystemTrack) {
        const sysResult = await this.deps.transcriber.transcribe({ audioPath: systemAbsolutePath });
        for (const s of sysResult.segments) segments.push({ ...s, source: 'system' as const });
        maxDurationMs = Math.max(maxDurationMs, sysResult.durationMs);
      }

      // Interleave by start time and label each line by speaker.
      segments.sort((a, b) => a.startMs - b.startMs);
      const text = segments
        .map((s) => `${s.source === 'system' ? 'Others' : 'You'}: ${s.text}`)
        .join('\n');
      const durationMs = Math.max(maxDurationMs, request.durationMs);
      recording.attachTranscript(text, segments, durationMs);
      await this.deps.meetingRepository.save(recording);

      const summary = await this.deps.summarizer.summarize({
        transcript: text,
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

    // TEMP: audio deletion disabled so recorded WAVs can be inspected while we
    // build per-source (mic vs system) transcription. Restore before shipping —
    // the privacy model deletes audio once transcript + summary exist.
    // try {
    //   await this.deps.fileStorage.delete(audioAbsolutePath);
    //   recording.clearAudio();
    //   await this.deps.meetingRepository.save(recording);
    // } catch {
    //   // intentional swallow — audio cleanup is best-effort.
    // }

    return { recording: recording.toPersistence() };
  }

  /**
   * Echo-cancel the mic against the system reference, returning a path to a
   * cleaned temp WAV. Falls back to the raw mic path on any failure so a flaky
   * canceller never blocks transcription.
   */
  private async cancelEcho(micPath: string, referencePath: string): Promise<string> {
    if (!this.deps.echoCanceller) return micPath;
    const outputPath = `${micPath}.aec.wav`;
    try {
      await this.deps.echoCanceller.cancel({ micPath, referencePath, outputPath });
      return outputPath;
    } catch {
      await this.deps.fileStorage.delete(outputPath).catch(() => {});
      return micPath;
    }
  }
}
