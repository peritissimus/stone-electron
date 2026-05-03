import {
  type IWorkspaceRepository,
  type IRenameFolderUseCase,
  type RenameFolderRequest,
  type RenameFolderResponse,
  type IPathService,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class RenameFolderUseCase implements IRenameFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: RenameFolderRequest): Promise<RenameFolderResponse> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      throw new Error('No active workspace');
    }

    if (!request.name || request.name.trim() === '') {
      throw new Error('Folder name is required');
    }

    const absolutePath = this.pathService.join(activeWorkspace.folderPath, request.path);
    const exists = await this.fileStorage.exists(absolutePath);
    if (!exists) {
      throw new Error(`Folder does not exist: ${request.path}`);
    }

    const parentDir = this.pathService.dirname(absolutePath);
    const newAbsolutePath = this.pathService.join(parentDir, request.name);
    await this.fileStorage.rename(absolutePath, newAbsolutePath);

    const newRelativePath = this.pathService.relative(activeWorkspace.folderPath, newAbsolutePath);
    return { oldPath: request.path, newPath: newRelativePath };
  }
}
