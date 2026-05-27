/**
 * SendToJournalUseCase — explicit publish action from the Meetings page.
 * Always appends a fresh entry under today's (or a chosen) journal,
 * reusing the existing AppendToJournalUseCase so it picks up identical
 * formatting + the existing chunk-index pipeline downstream.
 */

import {
  MeetingRecordingNotFoundError,
  type IMeetingRecordingRepository,
} from '../../../domain';
import type {
  ISendToJournalUseCase,
  SendToJournalRequest,
  SendToJournalResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

export interface SendToJournalUseCaseDeps {
  meetingRepository: IMeetingRecordingRepository;
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
}

export class SendToJournalUseCase implements ISendToJournalUseCase {
  constructor(private readonly deps: SendToJournalUseCaseDeps) {}

  async execute(request: SendToJournalRequest): Promise<SendToJournalResponse> {
    const recording = await this.deps.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);
    if (!recording.summary) {
      throw new Error(`Recording ${recording.id} has no summary to send`);
    }

    const header = `### ${recording.title}`;
    const body = `${header}\n${recording.summary}`;

    const result = await this.deps.appendToJournal(body, recording.workspaceId);

    const dateForRecord = request.journalDate ?? todayIsoDate();
    recording.markJournaledFor(dateForRecord);
    await this.deps.meetingRepository.save(recording);

    return {
      recording: recording.toPersistence(),
      journalNoteId: result.noteId,
    };
  }
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
