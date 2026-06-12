/**
 * DeleteMeetingRecordingUseCase — drops the DB row and any orphan audio
 * file still on disk (e.g. when the user deletes a failed recording
 * before retry).
 */

import type {
  IFileStorage,
  IMeetingRecordingRepository,
  IPathService,
  ISystemAudioTap,
  IWorkspaceRepository,
} from '../../../domain';
import type {
  IDeleteMeetingRecordingUseCase,
  DeleteMeetingRecordingRequest,
} from '../../../domain/ports/in/IMeetingUseCases';

export class DeleteMeetingRecordingUseCase implements IDeleteMeetingRecordingUseCase {
  constructor(
    private readonly meetingRepository: IMeetingRecordingRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
    private readonly systemAudioTap?: ISystemAudioTap,
  ) {}

  async execute(request: DeleteMeetingRecordingRequest): Promise<void> {
    // Cancel path: a live system-audio tap must die with the recording.
    try {
      await this.systemAudioTap?.stop(request.recordingId);
    } catch {
      // best-effort
    }

    const recording = await this.meetingRepository.findById(request.recordingId);
    if (!recording) return;

    if (recording.audioPath) {
      const workspace = await this.workspaceRepository.findById(recording.workspaceId);
      if (workspace) {
        const absolutePath = this.pathService.join(workspace.folderPath, recording.audioPath);
        try {
          await this.fileStorage.delete(absolutePath);
        } catch {
          // best-effort — DB row removal proceeds even if the file is gone.
        }
        try {
          await this.fileStorage.delete(`${absolutePath}.system.pcm`);
        } catch {
          // scratch system track may not exist.
        }
      }
    }

    await this.meetingRepository.delete(recording.id);
  }
}
