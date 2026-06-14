/**
 * ResummarizeMeetingUseCase — runs the summarizer again, optionally
 * with a different prompt. Per option (C) this updates the meeting row
 * only and never touches the journal — the user explicitly publishes
 * via SendToJournalUseCase.
 */

import {
  buildSummaryTranscript,
  DEFAULT_MEETING_SUMMARY_PROMPT,
  MeetingRecordingNotFoundError,
  type IMeetingRecordingRepository,
  type ISummarizationStrategy,
} from '../../../domain';
import type {
  IResummarizeMeetingUseCase,
  ResummarizeMeetingRequest,
  ResummarizeMeetingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

export interface ResummarizeMeetingUseCaseDeps {
  meetingRepository: IMeetingRecordingRepository;
  summarizer: ISummarizationStrategy;
  defaultPrompt?: string;
}

export class ResummarizeMeetingUseCase implements IResummarizeMeetingUseCase {
  constructor(private readonly deps: ResummarizeMeetingUseCaseDeps) {}

  async execute(request: ResummarizeMeetingRequest): Promise<ResummarizeMeetingResponse> {
    const recording = await this.deps.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);
    if (!recording.transcriptText) {
      throw new Error(`Recording ${recording.id} has no transcript to summarize`);
    }

    const prompt =
      request.promptTemplate ?? this.deps.defaultPrompt ?? DEFAULT_MEETING_SUMMARY_PROMPT;

    // Rebuild a confidence-tagged transcript from the stored segments so the
    // summarizer gets the same low-confidence hints as the first pass. Legacy
    // recordings without segments fall back to the plain stored text.
    const transcript =
      recording.transcriptSegments.length > 0
        ? buildSummaryTranscript(recording.transcriptSegments)
        : recording.transcriptText;

    const result = await this.deps.summarizer.summarize({
      transcript,
      promptTemplate: prompt,
    });

    recording.replaceSummary(result.summary, result.promptUsed);
    await this.deps.meetingRepository.save(recording);

    return { recording: recording.toPersistence() };
  }
}
