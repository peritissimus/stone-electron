/**
 * DeleteMeetingRecordingUseCase — drops the DB row and any orphan audio
 * file still on disk (e.g. when the user deletes a failed recording
 * before retry).
 */

import type {
  IFileStorage,
  IMeetingRecordingRepository,
  IPathService,
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
  ) {}

  async execute(request: DeleteMeetingRecordingRequest): Promise<void> {
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
      }
    }

    await this.meetingRepository.delete(recording.id);
  }
}
