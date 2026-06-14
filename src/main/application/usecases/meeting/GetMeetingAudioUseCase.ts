/**
 * GetMeetingAudioUseCase — read a recording's WAV tracks for in-app playback.
 *
 * Returns the mic track and (if present) the system track as raw bytes. The
 * renderer turns them into blob URLs for the audio player. Returns null tracks
 * when the audio has been cleaned up after a successful finalize.
 */

import {
  MeetingRecordingNotFoundError,
  type IFileStorage,
  type IMeetingRecordingRepository,
  type IPathService,
  type IWorkspaceRepository,
} from '../../../domain';
import {
  systemTrackPath,
  type GetMeetingAudioResponse,
  type IGetMeetingAudioUseCase,
} from '../../../domain/ports/in/IMeetingUseCases';

export class GetMeetingAudioUseCase implements IGetMeetingAudioUseCase {
  constructor(
    private readonly meetingRepository: IMeetingRecordingRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: { recordingId: string }): Promise<GetMeetingAudioResponse> {
    const recording = await this.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);
    if (!recording.audioPath) return { mic: null, system: null };

    const workspace = await this.workspaceRepository.findById(recording.workspaceId);
    if (!workspace) return { mic: null, system: null };

    const micPath = this.pathService.join(workspace.folderPath, recording.audioPath);
    const systemPath = this.pathService.join(
      workspace.folderPath,
      systemTrackPath(recording.audioPath),
    );

    const [mic, system] = await Promise.all([
      this.fileStorage.readBytes(micPath),
      this.fileStorage.readBytes(systemPath),
    ]);
    return { mic, system };
  }
}
