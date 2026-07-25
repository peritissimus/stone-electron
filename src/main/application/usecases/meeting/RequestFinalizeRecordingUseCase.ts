/**
 * RequestFinalizeRecordingUseCase — the producer side of finalize.
 *
 * Capturing a meeting ends with a finalize request, but the pipeline
 * (transcribe → summarize) is long and must survive an app restart. So instead
 * of running it inline, this enqueues a durable `meeting.finalize` job and
 * returns immediately. The JobRunner executes FinalizeRecordingUseCase in the
 * background; progress reaches the renderer via `meeting:statusChanged` events.
 */

import type { IJobQueue } from '../../../domain/ports/out/IJobQueue';
import type {
  IRequestFinalizeRecordingUseCase,
  FinalizeRecordingRequest,
  RequestFinalizeRecordingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

/** Job type key — shared between the producer (enqueue) and the DI handler. */
export const MEETING_FINALIZE_JOB = 'meeting.finalize';

export interface RequestFinalizeRecordingUseCaseDeps {
  jobQueue: IJobQueue;
}

export class RequestFinalizeRecordingUseCase implements IRequestFinalizeRecordingUseCase {
  constructor(private readonly deps: RequestFinalizeRecordingUseCaseDeps) {}

  async execute(request: FinalizeRecordingRequest): Promise<RequestFinalizeRecordingResponse> {
    const jobId = await this.deps.jobQueue.enqueue(MEETING_FINALIZE_JOB, {
      recordingId: request.recordingId,
      durationMs: request.durationMs,
    });
    return { jobId };
  }
}
