import {
  type IWorkspaceRepository,
  type IMoveFolderUseCase,
  type MoveFolderRequest,
  type MoveFolderResponse,
  type IPathService,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class MoveFolderUseCase implements IMoveFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: MoveFolderRequest): Promise<MoveFolderResponse> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      throw new Error('No active workspace');
    }

    if (!request.sourcePath || request.sourcePath.trim() === '') {
      throw new Error('Source path is required');
    }

    const sourceAbsolutePath = this.pathService.join(activeWorkspace.folderPath, request.sourcePath);
    const exists = await this.fileStorage.exists(sourceAbsolutePath);
    if (!exists) {
      throw new Error(`Folder does not exist: ${request.sourcePath}`);
    }

    const folderName = this.pathService.basename(request.sourcePath);
    const destParent = request.destinationPath
      ? this.pathService.join(activeWorkspace.folderPath, request.destinationPath)
      : activeWorkspace.folderPath;
    const destAbsolutePath = this.pathService.join(destParent, folderName);

    // Prevent moving a folder into itself
    if (destAbsolutePath.startsWith(sourceAbsolutePath + this.pathService.separator)) {
      throw new Error('Cannot move a folder into itself');
    }

    await this.fileStorage.rename(sourceAbsolutePath, destAbsolutePath);

    const newRelativePath = this.pathService.relative(activeWorkspace.folderPath, destAbsolutePath);
    return { oldPath: request.sourcePath, newPath: newRelativePath };
  }
}
