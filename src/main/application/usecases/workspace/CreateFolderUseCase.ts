import path from 'node:path';
import {
  type IWorkspaceRepository,
  type ICreateFolderUseCase,
  type CreateFolderRequest,
  type CreateFolderResponse,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class CreateFolderUseCase implements ICreateFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      throw new Error('No active workspace');
    }

    const basePath = request.parentPath
      ? path.join(activeWorkspace.folderPath, request.parentPath)
      : activeWorkspace.folderPath;
    const folderPath = path.join(basePath, request.name);

    await this.fileStorage.createDirectory(folderPath);

    // Return relative path from workspace root
    const relativePath = path.relative(activeWorkspace.folderPath, folderPath);
    return { path: relativePath };
  }
}
