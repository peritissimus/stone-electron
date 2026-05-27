import type { IMeetingRecordingRepository } from '../../../domain';
import type {
  IGetMeetingRecordingUseCase,
  GetMeetingRecordingRequest,
  GetMeetingRecordingResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

export class GetMeetingRecordingUseCase implements IGetMeetingRecordingUseCase {
  constructor(private readonly meetingRepository: IMeetingRecordingRepository) {}

  async execute(request: GetMeetingRecordingRequest): Promise<GetMeetingRecordingResponse> {
    const recording = await this.meetingRepository.findById(request.recordingId);
    return { recording: recording?.toPersistence() ?? null };
  }
}
