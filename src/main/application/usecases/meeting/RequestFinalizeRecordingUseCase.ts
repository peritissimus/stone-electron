/**
 * RequestFinalizeRecordingUseCase — the producer side of finalize.
 *
 * Capturing a meeting ends with a finalize request, but the pipeline
 * (transcribe → summarize) is long and must survive an app restart. So instead
 * of running it inline, this enqueues a durable `meeting.finalize` job and
 * returns immediately. The JobRunner executes FinalizeRecordingUseCase in the
 * background; progress reaches the renderer via `meeting:statusChanged` events.
 */

import { MeetingRecordingNotFoundError, type IMeetingRecordingRepository } from '../../../domain';
import type { IJobQueue } from '../../../domain/ports/out/IJobQueue';
import type {
  IFinalizeRecordingUseCase,
  FinalizeRecordingRequest,
  FinalizeRecordingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

/** Job type key — shared between the producer (enqueue) and the DI handler. */
export const MEETING_FINALIZE_JOB = 'meeting.finalize';

export interface RequestFinalizeRecordingUseCaseDeps {
  meetingRepository: IMeetingRecordingRepository;
  jobQueue: IJobQueue;
}

export class RequestFinalizeRecordingUseCase implements IFinalizeRecordingUseCase {
  constructor(private readonly deps: RequestFinalizeRecordingUseCaseDeps) {}

  async execute(request: FinalizeRecordingRequest): Promise<FinalizeRecordingResponse> {
    const recording = await this.deps.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);
    if (!recording.audioPath) {
      throw new Error(`Recording ${request.recordingId} has no audio path`);
    }

    await this.deps.jobQueue.enqueue(MEETING_FINALIZE_JOB, {
      recordingId: request.recordingId,
      durationMs: request.durationMs,
    });

    // Return the current (pre-pipeline) state; the renderer keeps showing
    // "finalizing" and updates as meeting:statusChanged events arrive.
    return { recording: recording.toPersistence() };
  }
}
