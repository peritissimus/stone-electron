/**
 * Shared post-capture reprocessing: echo-cancel the mic, transcribe mic + system
 * separately for "You"/"Others" attribution, persist the labelled transcript,
 * then summarize. Used by both FinalizeRecordingUseCase (first pass) and
 * RetranscribeMeetingUseCase (re-run on kept audio), so the two can't drift.
 */

import {
  buildSummaryTranscript,
  buildTranscriptText,
  type IEchoCanceller,
  type IEventPublisher,
  type IFileStorage,
  type IMeetingRecordingRepository,
  type ISummarizationStrategy,
  type ITranscriber,
  type MeetingRecordingEntity,
  type TranscriptSegment,
} from '../../../domain';

export interface MeetingReprocessDeps {
  meetingRepository: IMeetingRecordingRepository;
  fileStorage: IFileStorage;
  transcriber: ITranscriber;
  summarizer: ISummarizationStrategy;
  /** Pushes recording status to the renderer as the pipeline progresses. */
  eventPublisher: IEventPublisher;
  /** Optional — cancels speaker bleed from the mic using the system reference. */
  echoCanceller?: IEchoCanceller;
}

/** Broadcast the recording's current state so the renderer can reflect async
 *  finalize progress (transcribing → summarizing → ready/failed). */
export function publishMeetingStatus(
  eventPublisher: IEventPublisher,
  recording: MeetingRecordingEntity,
): void {
  eventPublisher.publish({
    type: 'meeting:statusChanged',
    timestamp: new Date(),
    payload: { recording: recording.toPersistence() },
  });
}

/**
 * Run transcription + summarization on a recording's stored audio, mutating and
 * saving the entity. Throws on failure — the caller decides how to mark it.
 */
export async function reprocessRecordingAudio(
  deps: MeetingReprocessDeps,
  recording: MeetingRecordingEntity,
  audioAbsolutePath: string,
  systemAbsolutePath: string,
  promptTemplate: string,
  requestDurationMs: number,
): Promise<void> {
  recording.markTranscribing();
  await deps.meetingRepository.save(recording);
  publishMeetingStatus(deps.eventPublisher, recording);

  const hasSystemTrack = await deps.fileStorage.exists(systemAbsolutePath);

  // Cancel speaker echo from the mic first: on speakers the system audio bleeds
  // into the mic and pollutes the "You" track; the system track is the clean
  // reference. Best-effort — on any failure we fall back to the raw mic.
  const micForTranscription = hasSystemTrack
    ? await cancelEcho(deps, audioAbsolutePath, systemAbsolutePath)
    : audioAbsolutePath;

  const micResult = await deps.transcriber.transcribe({ audioPath: micForTranscription });
  const segments: TranscriptSegment[] = micResult.segments.map((s) => ({
    ...s,
    source: 'mic' as const,
  }));
  let maxDurationMs = micResult.durationMs;

  if (micForTranscription !== audioAbsolutePath) {
    await deps.fileStorage.delete(micForTranscription).catch(() => {});
  }

  if (hasSystemTrack) {
    const sysResult = await deps.transcriber.transcribe({ audioPath: systemAbsolutePath });
    for (const s of sysResult.segments) segments.push({ ...s, source: 'system' as const });
    maxDurationMs = Math.max(maxDurationMs, sysResult.durationMs);
  }

  // Interleave by start time; store the clean labelled transcript but feed the
  // summarizer a copy that flags low-confidence lines so it can discount shaky
  // transcription rather than asserting it as fact.
  segments.sort((a, b) => a.startMs - b.startMs);
  const text = buildTranscriptText(segments);
  const durationMs = Math.max(maxDurationMs, requestDurationMs);
  recording.attachTranscript(text, segments, durationMs);
  await deps.meetingRepository.save(recording);
  publishMeetingStatus(deps.eventPublisher, recording);

  const summary = await deps.summarizer.summarize({
    transcript: buildSummaryTranscript(segments),
    promptTemplate,
  });
  recording.attachSummary(summary.summary, summary.promptUsed);
  await deps.meetingRepository.save(recording);
  publishMeetingStatus(deps.eventPublisher, recording);
}

/**
 * Echo-cancel the mic against the system reference, returning a path to a
 * cleaned temp WAV. Falls back to the raw mic path on any failure.
 */
async function cancelEcho(
  deps: MeetingReprocessDeps,
  micPath: string,
  referencePath: string,
): Promise<string> {
  if (!deps.echoCanceller) return micPath;
  const outputPath = `${micPath}.aec.wav`;
  try {
    await deps.echoCanceller.cancel({ micPath, referencePath, outputPath });
    return outputPath;
  } catch {
    await deps.fileStorage.delete(outputPath).catch(() => {});
    return micPath;
  }
}
