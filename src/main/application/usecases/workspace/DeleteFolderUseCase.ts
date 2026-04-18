import path from 'node:path';
import {
  type IWorkspaceRepository,
  type IDeleteFolderUseCase,
  type DeleteFolderRequest,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class DeleteFolderUseCase implements IDeleteFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(request: DeleteFolderRequest): Promise<void> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      throw new Error('No active workspace');
    }

    if (!request.path || request.path.trim() === '') {
      throw new Error('Folder path is required');
    }

    const absolutePath = path.join(activeWorkspace.folderPath, request.path);
    const exists = await this.fileStorage.exists(absolutePath);
    if (!exists) {
      throw new Error(`Folder does not exist: ${request.path}`);
    }

    await this.fileStorage.deleteDirectory(absolutePath);
  }
}
