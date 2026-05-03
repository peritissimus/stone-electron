import {
  type IWorkspaceRepository,
  type ICreateFolderUseCase,
  type CreateFolderRequest,
  type CreateFolderResponse,
  type IPathService,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class CreateFolderUseCase implements ICreateFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const activeWorkspace = await this.workspaceRepository.findActive();
    if (!activeWorkspace) {
      throw new Error('No active workspace');
    }

    const basePath = request.parentPath
      ? this.pathService.join(activeWorkspace.folderPath, request.parentPath)
      : activeWorkspace.folderPath;
    const folderPath = this.pathService.join(basePath, request.name);

    await this.fileStorage.createDirectory(folderPath);

    // Return relative path from workspace root
    const relativePath = this.pathService.relative(activeWorkspace.folderPath, folderPath);
    return { path: relativePath };
  }
}
