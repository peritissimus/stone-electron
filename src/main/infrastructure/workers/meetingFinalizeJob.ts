import { z } from 'zod';
import type {
  FinalizeRecordingRequest,
  IFinalizeRecordingUseCase,
} from '../../domain/ports/in/IMeetingUseCases';
import type { JobHandler } from './JobRunner';

export const MeetingFinalizeJobPayloadSchema = z
  .object({
    recordingId: z.string().trim().min(1),
    durationMs: z.number().nonnegative(),
  })
  .strict();

export function createMeetingFinalizeJobHandler(
  finalizeRecording: IFinalizeRecordingUseCase,
): JobHandler {
  return async (payload, context) => {
    const request: FinalizeRecordingRequest = MeetingFinalizeJobPayloadSchema.parse(payload);
    await finalizeRecording.execute(request, { signal: context.signal });
  };
}
