/**
 * Workspace Use Cases
 *
 * Application layer implementations for workspace operations.
 */

import { generateId } from '@shared/utils/id';
import path from 'node:path';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  WorkspaceEntity,
  type WorkspaceProps,
  type IWorkspaceRepository,
  WorkspaceNotFoundError,
} from '../../domain';
import type { IFileStorage } from '../../domain/ports/out/IFileStorage';
import type { ISystemService } from '../../domain/ports/out/ISystemService';
import type { INoteRepository } from '../../domain/ports/out/INoteRepository';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';
import type { NoteProps } from '../../domain/entities';

// ============================================================================
// Use Case Implementations
// ============================================================================

export class CreateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  async execute(request: {
    name: string;
    folderPath: string;
  }): Promise<{ workspace: WorkspaceProps }> {
    const workspace = WorkspaceEntity.create({
      id: generateId(),
      name: request.name,
      folderPath: request.folderPath,
      isActive: false,
    });

    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.emit(EVENTS.WORKSPACE_CREATED, { workspace: workspace.toPersistence() });

    return { workspace: workspace.toPersistence() };
  }
}

export class GetWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(request: { id: string }): Promise<{ workspace: WorkspaceProps }> {
    const workspaceProps = await this.workspaceRepository.findById(request.id);
    if (!workspaceProps) {
      throw new WorkspaceNotFoundError(request.id);
    }

    return { workspace: workspaceProps };
  }
}

export class ListWorkspacesUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(): Promise<{ workspaces: WorkspaceProps[] }> {
    const workspaces = await this.workspaceRepository.findAll();
    return { workspaces };
  }
}

export class SetActiveWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  async execute(request: { id: string }): Promise<{ workspace: WorkspaceProps }> {
    const workspaceProps = await this.workspaceRepository.findById(request.id);
    if (!workspaceProps) {
      throw new WorkspaceNotFoundError(request.id);
    }

    // Deactivate all workspaces
    const allWorkspaces = await this.workspaceRepository.findAll();
    for (const ws of allWorkspaces) {
      if (ws.isActive && ws.id !== request.id) {
        const entity = WorkspaceEntity.fromPersistence(ws);
        entity.deactivate();
        await this.workspaceRepository.save(entity);
      }
    }

    // Activate the requested workspace
    const workspace = WorkspaceEntity.fromPersistence(workspaceProps);
    workspace.activate();
    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.emit(EVENTS.WORKSPACE_SWITCHED, { workspace: workspace.toPersistence() });

    return { workspace: workspace.toPersistence() };
  }
}

export class GetActiveWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(): Promise<{ workspace: WorkspaceProps | null }> {
    const workspace = await this.workspaceRepository.findActive();
    return { workspace };
  }
}

export class DeleteWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  async execute(request: { id: string }): Promise<void> {
    const exists = await this.workspaceRepository.exists(request.id);
    if (!exists) {
      throw new WorkspaceNotFoundError(request.id);
    }

    await this.workspaceRepository.delete(request.id);

    this.eventPublisher?.emit(EVENTS.WORKSPACE_DELETED, { id: request.id });
  }
}

export class UpdateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  async execute(request: { id: string; name?: string }): Promise<{ workspace: WorkspaceProps }> {
    const workspaceProps = await this.workspaceRepository.findById(request.id);
    if (!workspaceProps) {
      throw new WorkspaceNotFoundError(request.id);
    }

    const workspace = WorkspaceEntity.fromPersistence(workspaceProps);

    if (request.name) {
      workspace.rename(request.name);
    }

    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.emit(EVENTS.WORKSPACE_UPDATED, { workspace: workspace.toPersistence() });

    return { workspace: workspace.toPersistence() };
  }
}

export class SelectFolderUseCase {
  constructor(private readonly systemService: ISystemService) {}

  async execute(request?: {
    title?: string;
    defaultPath?: string;
  }): Promise<{ canceled: boolean; folderPath?: string }> {
    const folderPath = await this.systemService.selectFolder({
      title: request?.title || 'Select Workspace Folder',
      defaultPath: request?.defaultPath,
      buttonLabel: 'Select Folder',
    });

    if (!folderPath) {
      return { canceled: true };
    }

    return { canceled: false, folderPath };
  }
}

export class ValidatePathUseCase {
  constructor(private readonly systemService: ISystemService) {}

  async execute(request: { folderPath: string }): Promise<{ valid: boolean; error?: string }> {
    const isValid = await this.systemService.validatePath(request.folderPath);
    if (!isValid) {
      return { valid: false, error: 'Path does not exist or is not accessible' };
    }
    return { valid: true };
  }
}

export class CreateFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(request: {
    name: string;
    parentPath?: string;
  }): Promise<{ path: string }> {
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

export class RenameFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(request: {
    path: string;
    name: string;
  }): Promise<{ oldPath: string; newPath: string }> {
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

export class DeleteFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(request: { path: string }): Promise<void> {
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

export class MoveFolderUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(request: {
    sourcePath: string;
    destinationPath: string | null;
  }): Promise<{ oldPath: string; newPath: string }> {
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

interface FileEntry {
  relativePath: string;
  path: string;
}

interface FolderStructure {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'folder';
  children?: FolderStructure[];
}

export class ScanWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(request: { workspaceId: string }): Promise<{
    files: FileEntry[];
    structure: FolderStructure[];
    total: number;
    counts: Record<string, number>;
  }> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(request.workspaceId);
    }

    // Get all markdown files
    const markdownPaths = await this.fileStorage.glob('**/*.md', workspace.folderPath);

    // Build files array with relativePath and absolute path
    const files: FileEntry[] = markdownPaths.map((relativePath) => ({
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
        const folderPath = parts.slice(0, -1).join('/');
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

  private async buildFolderStructure(basePath: string, relativePath: string): Promise<FolderStructure[]> {
    const currentPath = relativePath ? path.join(basePath, relativePath) : basePath;
    const items = await this.fileStorage.listFiles(currentPath);

    const result: FolderStructure[] = [];

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

export interface SyncResult {
  notes: {
    created: number;
    updated: number;
    deleted: number;
  };
  durationMs: number;
}

export class SyncWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(request?: { workspaceId?: string }): Promise<SyncResult> {
    const startTime = Date.now();

    let workspace: WorkspaceProps | null;
    if (request?.workspaceId) {
      workspace = await this.workspaceRepository.findById(request.workspaceId);
      if (!workspace) {
        throw new WorkspaceNotFoundError(request.workspaceId);
      }
    } else {
      workspace = await this.workspaceRepository.findActive();
      if (!workspace) {
        throw new Error('No active workspace');
      }
    }

    // Get all markdown files in workspace
    const markdownFiles = await this.fileStorage.glob('**/*.md', workspace.folderPath);

    // Get existing notes for this workspace
    const existingNotes = await this.noteRepository.findAll({ workspaceId: workspace.id });
    const existingPaths = new Set(existingNotes.map((n) => n.filePath));
    const foundPaths = new Set<string>();

    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Process each file
    for (const relativePath of markdownFiles) {
      foundPaths.add(relativePath);
      const absolutePath = path.join(workspace.folderPath, relativePath);
      const fileInfo = await this.fileStorage.getFileInfo(absolutePath);

      if (!fileInfo) continue;

      const existingNote = existingNotes.find((n) => n.filePath === relativePath);

      if (!existingNote) {
        // Create new note entry (basic sync - full content processing would be separate)
        created++;
      } else if (existingNote.updatedAt < fileInfo.modifiedAt) {
        // Note was modified externally
        updated++;
      }
    }

    // Mark deleted notes
    for (const note of existingNotes) {
      if (note.filePath && !foundPaths.has(note.filePath)) {
        deleted++;
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      notes: { created, updated, deleted },
      durationMs,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface IWorkspaceUseCases {
  createWorkspace: CreateWorkspaceUseCase;
  getWorkspace: GetWorkspaceUseCase;
  listWorkspaces: ListWorkspacesUseCase;
  setActiveWorkspace: SetActiveWorkspaceUseCase;
  getActiveWorkspace: GetActiveWorkspaceUseCase;
  deleteWorkspace: DeleteWorkspaceUseCase;
  updateWorkspace: UpdateWorkspaceUseCase;
  selectFolder: SelectFolderUseCase;
  validatePath: ValidatePathUseCase;
  createFolder: CreateFolderUseCase;
  renameFolder: RenameFolderUseCase;
  deleteFolder: DeleteFolderUseCase;
  moveFolder: MoveFolderUseCase;
  scanWorkspace: ScanWorkspaceUseCase;
  syncWorkspace: SyncWorkspaceUseCase;
}

export interface WorkspaceUseCasesDeps {
  workspaceRepository: IWorkspaceRepository;
  noteRepository: INoteRepository;
  fileStorage: IFileStorage;
  systemService: ISystemService;
  eventPublisher?: IEventPublisher;
}

export function createWorkspaceUseCases(deps: WorkspaceUseCasesDeps): IWorkspaceUseCases {
  const { workspaceRepository, noteRepository, fileStorage, systemService, eventPublisher } = deps;

  return {
    createWorkspace: new CreateWorkspaceUseCase(workspaceRepository, eventPublisher),
    getWorkspace: new GetWorkspaceUseCase(workspaceRepository),
    listWorkspaces: new ListWorkspacesUseCase(workspaceRepository),
    setActiveWorkspace: new SetActiveWorkspaceUseCase(workspaceRepository, eventPublisher),
    getActiveWorkspace: new GetActiveWorkspaceUseCase(workspaceRepository),
    deleteWorkspace: new DeleteWorkspaceUseCase(workspaceRepository, eventPublisher),
    updateWorkspace: new UpdateWorkspaceUseCase(workspaceRepository, eventPublisher),
    selectFolder: new SelectFolderUseCase(systemService),
    validatePath: new ValidatePathUseCase(systemService),
    createFolder: new CreateFolderUseCase(workspaceRepository, fileStorage),
    renameFolder: new RenameFolderUseCase(workspaceRepository, fileStorage),
    deleteFolder: new DeleteFolderUseCase(workspaceRepository, fileStorage),
    moveFolder: new MoveFolderUseCase(workspaceRepository, fileStorage),
    scanWorkspace: new ScanWorkspaceUseCase(workspaceRepository, fileStorage),
    syncWorkspace: new SyncWorkspaceUseCase(workspaceRepository, noteRepository, fileStorage),
  };
}
