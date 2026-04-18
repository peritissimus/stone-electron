import path from 'node:path';
import {
  type IWorkspaceRepository,
  type IMoveFolderUseCase,
  type MoveFolderRequest,
  type MoveFolderResponse,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class MoveFolderUseCase implements IMoveFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(request: MoveFolderRequest): Promise<MoveFolderResponse> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      throw new Error('No active workspace');
    }

    if (!request.sourcePath || request.sourcePath.trim() === '') {
      throw new Error('Source path is required');
    }

    const sourceAbsolutePath = path.join(activeWorkspace.folderPath, request.sourcePath);
    const exists = await this.fileStorage.exists(sourceAbsolutePath);
    if (!exists) {
      throw new Error(`Folder does not exist: ${request.sourcePath}`);
    }

    const folderName = path.basename(request.sourcePath);
    const destParent = request.destinationPath
      ? path.join(activeWorkspace.folderPath, request.destinationPath)
      : activeWorkspace.folderPath;
    const destAbsolutePath = path.join(destParent, folderName);

    // Prevent moving a folder into itself
    if (destAbsolutePath.startsWith(sourceAbsolutePath + path.sep)) {
      throw new Error('Cannot move a folder into itself');
    }

    await this.fileStorage.rename(sourceAbsolutePath, destAbsolutePath);

    const newRelativePath = path.relative(activeWorkspace.folderPath, destAbsolutePath);
    return { oldPath: request.sourcePath, newPath: newRelativePath };
  }
}
