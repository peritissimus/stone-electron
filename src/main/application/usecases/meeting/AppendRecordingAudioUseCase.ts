/**
 * AppendRecordingAudioUseCase — writes a WAV byte chunk from the renderer
 * to the reserved audio file. v1 expects the renderer to send a single
 * complete WAV blob; future streaming variants can call this repeatedly
 * with `append: true`.
 */

import {
  MeetingRecordingNotFoundError,
  type IFileStorage,
  type IMeetingRecordingRepository,
  type IPathService,
  type IWorkspaceRepository,
} from '../../../domain';
import type {
  IAppendRecordingAudioUseCase,
  AppendRecordingAudioRequest,
} from '../../../domain/ports/in/IMeetingUseCases';

export class AppendRecordingAudioUseCase implements IAppendRecordingAudioUseCase {
  constructor(
    private readonly meetingRepository: IMeetingRecordingRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: AppendRecordingAudioRequest): Promise<void> {
    const recording = await this.meetingRepository.findById(request.recordingId);
    if (!recording) throw new MeetingRecordingNotFoundError(request.recordingId);
    if (!recording.audioPath) {
      throw new Error(`Recording ${request.recordingId} has no audio path`);
    }

    const workspace = await this.workspaceRepository.findById(recording.workspaceId);
    if (!workspace) throw new Error(`Workspace ${recording.workspaceId} no longer exists`);

    const absolutePath = this.pathService.join(workspace.folderPath, recording.audioPath);
    await this.fileStorage.writeBytes(absolutePath, new Uint8Array(request.chunk), {
      append: false,
    });
  }
}
