import { Schema } from 'effect';
import type { FinalizeRecordingRequest } from '../../domain/ports/in/IMeetingUseCases';
import type { JobHandler } from './JobRunner';

export const MeetingFinalizeJobPayloadSchema = Schema.Struct({
  recordingId: Schema.NonEmptyTrimmedString,
  durationMs: Schema.NonNegative,
});

const decodeMeetingFinalizeJobPayload = Schema.decodeUnknownSync(MeetingFinalizeJobPayloadSchema, {
  onExcessProperty: 'error',
});

export function createMeetingFinalizeJobHandler(
  finalizeRecording: (
    request: FinalizeRecordingRequest,
    signal: AbortSignal,
  ) => Promise<void>,
): JobHandler {
  return async (payload, context) => {
    const request: FinalizeRecordingRequest = decodeMeetingFinalizeJobPayload(payload);
    await finalizeRecording(request, context.signal);
  };
}
