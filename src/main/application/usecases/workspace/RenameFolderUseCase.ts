import path from 'node:path';
import {
  type IWorkspaceRepository,
  type IRenameFolderUseCase,
  type RenameFolderRequest,
  type RenameFolderResponse,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class RenameFolderUseCase implements IRenameFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(request: RenameFolderRequest): Promise<RenameFolderResponse> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      throw new Error('No active workspace');
    }

    if (!request.name || request.name.trim() === '') {
      throw new Error('Folder name is required');
    }

    const absolutePath = path.join(activeWorkspace.folderPath, request.path);
    const exists = await this.fileStorage.exists(absolutePath);
    if (!exists) {
      throw new Error(`Folder does not exist: ${request.path}`);
    }

    const parentDir = path.dirname(absolutePath);
    const newAbsolutePath = path.join(parentDir, request.name);
    await this.fileStorage.rename(absolutePath, newAbsolutePath);

    const newRelativePath = path.relative(activeWorkspace.folderPath, newAbsolutePath);
    return { oldPath: request.path, newPath: newRelativePath };
  }
}
