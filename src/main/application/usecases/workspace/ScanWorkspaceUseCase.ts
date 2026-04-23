import path from 'node:path';
import {
  type IWorkspaceRepository,
  type IScanWorkspaceUseCase,
  type ScanWorkspaceRequest,
  type ScanWorkspaceResponse,
  WorkspaceNotFoundError,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';

export class ScanWorkspaceUseCase implements IScanWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(request: ScanWorkspaceRequest): Promise<ScanWorkspaceResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(request.workspaceId);
    }

    // Get all markdown files
    const markdownPaths = await this.fileStorage.glob('**/*.md', workspace.folderPath);

    // Build files array with relativePath and absolute path
    const files: ScanWorkspaceResponse['files'] = markdownPaths.map((relativePath) => ({
      relativePath: relativePath.replace(/\\/g, '/'), // Normalize to posix
      path: path.join(workspace.folderPath, relativePath),
    }));

    // Build folder structure tree
    const structure = await this.buildFolderStructure(workspace.folderPath, '');

    // Build counts per folder
    const counts: Record<string, number> = { __root__: files.length };
    for (const file of files) {
      const parts = file.relativePath.split('/');
      if (parts.length > 1) {
        // Count for each level of the path
        let currentPath = '';
        for (const part of parts.slice(0, -1)) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          counts[currentPath] = (counts[currentPath] || 0) + 1;
        }
      }
    }

    return {
      files,
      structure,
      total: files.length,
      counts,
    };
  }

  private async buildFolderStructure(
    basePath: string,
    relativePath: string,
  ): Promise<ScanWorkspaceResponse['structure']> {
    const currentPath = relativePath ? path.join(basePath, relativePath) : basePath;
    const items = await this.fileStorage.listFiles(currentPath);

    const result: ScanWorkspaceResponse['structure'] = [];

    for (const item of items) {
      // Skip hidden files/folders
      if (item.name.startsWith('.')) continue;

      const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;

      if (item.isDirectory) {
        const children = await this.buildFolderStructure(basePath, itemRelativePath);
        result.push({
          name: item.name,
          path: item.path,
          relativePath: itemRelativePath.replace(/\\/g, '/'),
          type: 'folder',
          children,
        });
      } else if (item.name.endsWith('.md')) {
        result.push({
          name: item.name,
          path: item.path,
          relativePath: itemRelativePath.replace(/\\/g, '/'),
          type: 'file',
        });
      }
    }

    return result;
  }
}
