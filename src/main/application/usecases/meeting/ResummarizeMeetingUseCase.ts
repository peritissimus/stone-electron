/**
 * ResummarizeMeetingUseCase — runs the summarizer again, optionally
 * with a different prompt. Per option (C) this updates the meeting row
 * only and never touches the journal — the user explicitly publishes
 * via SendToJournalUseCase.
 */

import {
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

    const result = await this.deps.summarizer.summarize({
      transcript: recording.transcriptText,
      promptTemplate: prompt,
    });

    recording.replaceSummary(result.summary, result.promptUsed);
    await this.deps.meetingRepository.save(recording);

    return { recording: recording.toPersistence() };
  }
}
