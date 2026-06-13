/**
 * ReserveRecordingSlotUseCase — allocate a recording id + audio path
 * before capture begins, and persist the placeholder row.
 *
 * Audio lives under `<workspace>/.stone/recordings/<id>.wav`. The path
 * is workspace-relative in the DB so the user can move workspaces.
 */

import { MeetingRecordingEntity } from '../../../domain';
import type {
  IMeetingRecordingRepository,
  IWorkspaceRepository,
  IFileStorage,
  IIdGenerator,
  IPathService,
} from '../../../domain';
import type {
  IReserveRecordingSlotUseCase,
  ReserveRecordingSlotRequest,
  ReserveRecordingSlotResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

export const RECORDINGS_DIR = '.stone/recordings';

export class ReserveRecordingSlotUseCase implements IReserveRecordingSlotUseCase {
  constructor(
    private readonly meetingRepository: IMeetingRecordingRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly idGenerator: IIdGenerator,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: ReserveRecordingSlotRequest): Promise<ReserveRecordingSlotResponse> {
    const workspace = request.workspaceId
      ? await this.workspaceRepository.findById(request.workspaceId)
      : await this.workspaceRepository.findActive();
    if (!workspace) {
      throw new Error('No active workspace');
    }

    const id = this.idGenerator.generate();
    const audioRelativePath = `${RECORDINGS_DIR}/${id}.wav`;
    const audioAbsolutePath = this.pathService.join(workspace.folderPath, audioRelativePath);

    await this.fileStorage.createDirectory(
      this.pathService.join(workspace.folderPath, RECORDINGS_DIR),
    );

    const recording = MeetingRecordingEntity.create({
      id,
      workspaceId: workspace.id,
      title: request.title ?? '',
      audioPath: audioRelativePath,
    });
    await this.meetingRepository.save(recording);

    // System audio is captured in the renderer via getDisplayMedia loopback
    // and mixed with the mic before recording — the permission attributes to
    // the app itself, and the renderer reports the actual capture mode. So this
    // slot just allocates the id/path; systemAudio is always false here.
    return { recordingId: id, audioAbsolutePath, systemAudio: false };
  }
}
