/**
 * WorkspaceUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateWorkspaceUseCase,
  GetWorkspaceUseCase,
  ListWorkspacesUseCase,
  SetActiveWorkspaceUseCase,
  GetActiveWorkspaceUseCase,
  DeleteWorkspaceUseCase,
  UpdateWorkspaceUseCase,
  SelectFolderUseCase,
  ValidatePathUseCase,
  CreateFolderUseCase,
  RenameFolderUseCase,
  DeleteFolderUseCase,
  MoveFolderUseCase,
  ScanWorkspaceUseCase,
  SyncWorkspaceUseCase,
} from '../../../../src/main/application/usecases/workspace';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { ISystemBridge } from '../../../../src/main/domain/ports/out/ISystemBridge';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import type { IMarkdownProcessor } from '../../../../src/main/domain/ports/out/IMarkdownProcessor';
import { WorkspaceNotFoundError } from '../../../../src/main/domain/errors';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import { DEFAULT_APP_CONFIG } from '../../../../src/shared/types/settings';
import { createMockIdGenerator, createMockPathService } from './testDoubles';

// Mock factories
function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findByFolderPath: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
    exists: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    rename: vi.fn(),
    createDirectory: vi.fn(),
    deleteDirectory: vi.fn(),
    listFiles: vi.fn(),
    glob: vi.fn(),
    getFileInfo: vi.fn(),
    copy: vi.fn(),
    watch: vi.fn(),
  } as unknown as IFileStorage;
}

function createMockSystemBridge(): ISystemBridge {
  return {
    selectFolder: vi.fn(),
    validatePath: vi.fn(),
    openPath: vi.fn(),
    revealInFinder: vi.fn(),
    getAppVersion: vi.fn(),
    getPlatformInfo: vi.fn(),
  } as unknown as ISystemBridge;
}

function createMockAppConfigRepository(): IAppConfigRepository {
  return {
    get: vi.fn().mockResolvedValue(DEFAULT_APP_CONFIG),
    set: vi.fn(),
    update: vi.fn(),
  } as unknown as IAppConfigRepository;
}

function createMockNoteRepository(): INoteRepository {
  return {
    findAll: vi.fn(),
    save: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockEventPublisher(): IEventPublisher {
  return {
    publish: vi.fn(),
    publishAll: vi.fn(),
    emit: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
  } as unknown as IEventPublisher;
}

function createMockMarkdownProcessor(): IMarkdownProcessor {
  return {
    htmlToMarkdown: vi.fn().mockReturnValue(''),
    markdownToHtml: vi.fn().mockResolvedValue(''),
    parseFrontmatter: vi.fn().mockReturnValue({ content: '', metadata: {} }),
    updateFrontmatter: vi.fn().mockReturnValue(''),
    extractTitle: vi.fn().mockReturnValue(null),
    extractPlainText: vi.fn().mockReturnValue(''),
    extractLinks: vi.fn().mockReturnValue([]),
    extractWikiLinks: vi.fn().mockReturnValue([]),
    htmlToPlainText: vi.fn().mockReturnValue(''),
  } as unknown as IMarkdownProcessor;
}

function createWorkspaceProps(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    folderPath: '/test/workspace',
    isActive: false,
    createdAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

describe('WorkspaceUseCases', () => {
  describe('CreateWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let eventPublisher: IEventPublisher;
    let fileStorage: IFileStorage;
    let useCase: CreateWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      eventPublisher = createMockEventPublisher();
      fileStorage = createMockFileStorage();
      useCase = new CreateWorkspaceUseCase(
        workspaceRepo,
        createMockIdGenerator(),
        fileStorage,
        createMockAppConfigRepository(),
        createMockPathService(),
        eventPublisher,
      );
    });

    it('creates workspace with name and folderPath', async () => {
      vi.mocked(workspaceRepo.findAll).mockResolvedValue([]);
      vi.mocked(workspaceRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({
        name: 'My Workspace',
        folderPath: '/path/to/workspace',
      });

      expect(result.workspace.name).toBe('My Workspace');
      expect(result.workspace.folderPath).toBe('/path/to/workspace');
      expect(result.workspace.isActive).toBe(false);
      expect(workspaceRepo.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('scaffolds the standard folders from the location policy', async () => {
      vi.mocked(workspaceRepo.findAll).mockResolvedValue([]);
      vi.mocked(workspaceRepo.save).mockResolvedValue(undefined);

      await useCase.execute({ name: 'Fresh', folderPath: '/ws' });

      const created = vi.mocked(fileStorage.createDirectory).mock.calls.map((c) => c[0]);
      expect(created).toContain('/ws');
      // Defaults: Journal (journalFolder), Personal (defaultNoteFolder +
      // personal slot, deduped), Work (work slot).
      expect(created).toContain('/ws/Journal');
      expect(created).toContain('/ws/Personal');
      expect(created).toContain('/ws/Work');
      // Personal appears once despite being both default folder and slot.
      expect(created.filter((p) => p === '/ws/Personal')).toHaveLength(1);
    });

    it('returns the existing workspace when the folder is already in use', async () => {
      const existing = createWorkspaceProps({
        id: 'ws-existing',
        name: 'Stone',
        folderPath: '/path/to/workspace',
      });
      vi.mocked(workspaceRepo.findAll).mockResolvedValue([existing]);

      const result = await useCase.execute({
        name: 'Different Name',
        folderPath: '/path/to/workspace',
      });

      // folder_path is UNIQUE — re-creating over the same folder is
      // idempotent rather than a constraint violation.
      expect(result.workspace.id).toBe('ws-existing');
      expect(workspaceRepo.save).not.toHaveBeenCalled();
      expect(eventPublisher.publish).not.toHaveBeenCalled();
      // The scaffold still runs, backfilling folders on a bare workspace.
      expect(fileStorage.createDirectory).toHaveBeenCalledWith('/path/to/workspace/Journal');
    });
  });

  describe('GetWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let useCase: GetWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      useCase = new GetWorkspaceUseCase(workspaceRepo);
    });

    it('returns workspace when found', async () => {
      const workspaceProps = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspaceProps);

      const result = await useCase.execute({ id: 'ws-1' });

      expect(result.workspace).toEqual(workspaceProps);
      expect(workspaceRepo.findById).toHaveBeenCalledWith('ws-1');
    });

    it('throws WorkspaceNotFoundError when not found', async () => {
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(WorkspaceNotFoundError);
    });
  });

  describe('ListWorkspacesUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let useCase: ListWorkspacesUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      useCase = new ListWorkspacesUseCase(workspaceRepo);
    });

    it('returns all workspaces', async () => {
      const workspaces = [
        createWorkspaceProps({ id: 'ws-1' }),
        createWorkspaceProps({ id: 'ws-2', name: 'Second Workspace' }),
      ];
      vi.mocked(workspaceRepo.findAll).mockResolvedValue(workspaces);

      const result = await useCase.execute();

      expect(result.workspaces).toHaveLength(2);
      expect(workspaceRepo.findAll).toHaveBeenCalled();
    });
  });

  describe('SetActiveWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let eventPublisher: IEventPublisher;
    let useCase: SetActiveWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new SetActiveWorkspaceUseCase(workspaceRepo, eventPublisher);
    });

    it('activates workspace and deactivates others', async () => {
      const targetWorkspace = createWorkspaceProps({ id: 'ws-1', isActive: false });
      const otherWorkspace = createWorkspaceProps({ id: 'ws-2', isActive: true });

      vi.mocked(workspaceRepo.findById).mockResolvedValue(targetWorkspace);
      vi.mocked(workspaceRepo.findAll).mockResolvedValue([targetWorkspace, otherWorkspace]);
      vi.mocked(workspaceRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'ws-1' });

      expect(result.workspace.isActive).toBe(true);
      expect(workspaceRepo.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('throws WorkspaceNotFoundError when workspace not found', async () => {
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(WorkspaceNotFoundError);
    });
  });

  describe('GetActiveWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let useCase: GetActiveWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      useCase = new GetActiveWorkspaceUseCase(workspaceRepo);
    });

    it('returns active workspace', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);

      const result = await useCase.execute();

      expect(result.workspace).toEqual(activeWorkspace);
    });

    it('returns null when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      const result = await useCase.execute();

      expect(result.workspace).toBeNull();
    });
  });

  describe('DeleteWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let eventPublisher: IEventPublisher;
    let useCase: DeleteWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new DeleteWorkspaceUseCase(workspaceRepo, eventPublisher);
    });

    it('deletes workspace', async () => {
      vi.mocked(workspaceRepo.exists).mockResolvedValue(true);
      vi.mocked(workspaceRepo.delete).mockResolvedValue(undefined);

      await useCase.execute({ id: 'ws-1' });

      expect(workspaceRepo.delete).toHaveBeenCalledWith('ws-1');
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('throws WorkspaceNotFoundError when workspace not found', async () => {
      vi.mocked(workspaceRepo.exists).mockResolvedValue(false);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(WorkspaceNotFoundError);
    });
  });

  describe('UpdateWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let eventPublisher: IEventPublisher;
    let useCase: UpdateWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new UpdateWorkspaceUseCase(workspaceRepo, eventPublisher);
    });

    it('updates workspace name', async () => {
      const workspaceProps = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspaceProps);
      vi.mocked(workspaceRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'ws-1', name: 'New Name' });

      expect(result.workspace.name).toBe('New Name');
      expect(workspaceRepo.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('throws WorkspaceNotFoundError when workspace not found', async () => {
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent', name: 'New Name' })).rejects.toThrow(
        WorkspaceNotFoundError,
      );
    });
  });

  describe('SelectFolderUseCase', () => {
    let systemService: ISystemBridge;
    let appConfigRepository: IAppConfigRepository;
    let useCase: SelectFolderUseCase;

    beforeEach(() => {
      systemService = createMockSystemBridge();
      appConfigRepository = createMockAppConfigRepository();
      useCase = new SelectFolderUseCase(systemService, appConfigRepository);
    });

    it('returns selected folder path', async () => {
      vi.mocked(systemService.selectFolder).mockResolvedValue('/selected/path');

      const result = await useCase.execute({ title: 'Select Folder' });

      expect(result.canceled).toBe(false);
      expect(result.folderPath).toBe('/selected/path');
    });

    it('returns canceled when no folder selected', async () => {
      vi.mocked(systemService.selectFolder).mockResolvedValue(null);

      const result = await useCase.execute();

      expect(result.canceled).toBe(true);
      expect(result.folderPath).toBeUndefined();
    });
  });

  describe('ValidatePathUseCase', () => {
    let systemService: ISystemBridge;
    let useCase: ValidatePathUseCase;

    beforeEach(() => {
      systemService = createMockSystemBridge();
      useCase = new ValidatePathUseCase(systemService);
    });

    it('returns valid true for valid path', async () => {
      vi.mocked(systemService.validatePath).mockResolvedValue(true);

      const result = await useCase.execute({ folderPath: '/valid/path' });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid false with error for invalid path', async () => {
      vi.mocked(systemService.validatePath).mockResolvedValue(false);

      const result = await useCase.execute({ folderPath: '/invalid/path' });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('CreateFolderUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let useCase: CreateFolderUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      useCase = new CreateFolderUseCase(workspaceRepo, fileStorage, createMockPathService());
    });

    it('creates folder in active workspace', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);

      const result = await useCase.execute({ name: 'new-folder' });

      expect(result.path).toBe('new-folder');
      expect(fileStorage.createDirectory).toHaveBeenCalled();
    });

    it('throws error when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      await expect(useCase.execute({ name: 'new-folder' })).rejects.toThrow('No active workspace');
    });
  });

  describe('RenameFolderUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let useCase: RenameFolderUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      useCase = new RenameFolderUseCase(workspaceRepo, fileStorage, createMockPathService());
    });

    it('renames folder', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.rename).mockResolvedValue(undefined);

      const result = await useCase.execute({ path: 'old-folder', name: 'new-folder' });

      expect(result.oldPath).toBe('old-folder');
      expect(result.newPath).toBe('new-folder');
      expect(fileStorage.rename).toHaveBeenCalled();
    });

    it('throws error when folder does not exist', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);

      await expect(useCase.execute({ path: 'nonexistent', name: 'new-name' })).rejects.toThrow(
        'Folder does not exist',
      );
    });

    it('throws error when name is empty', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);

      await expect(useCase.execute({ path: 'folder', name: '' })).rejects.toThrow(
        'Folder name is required',
      );
    });
  });

  describe('DeleteFolderUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let useCase: DeleteFolderUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      useCase = new DeleteFolderUseCase(workspaceRepo, fileStorage, createMockPathService());
    });

    it('deletes folder', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.deleteDirectory).mockResolvedValue(undefined);

      await useCase.execute({ path: 'folder-to-delete' });

      expect(fileStorage.deleteDirectory).toHaveBeenCalled();
    });

    it('throws error when folder does not exist', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);

      await expect(useCase.execute({ path: 'nonexistent' })).rejects.toThrow(
        'Folder does not exist',
      );
    });

    it('throws error when path is empty', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);

      await expect(useCase.execute({ path: '' })).rejects.toThrow('Folder path is required');
    });
  });

  describe('MoveFolderUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let useCase: MoveFolderUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      useCase = new MoveFolderUseCase(workspaceRepo, fileStorage, createMockPathService());
    });

    it('moves folder to new location', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.rename).mockResolvedValue(undefined);

      const result = await useCase.execute({
        sourcePath: 'source-folder',
        destinationPath: 'dest',
      });

      expect(result.oldPath).toBe('source-folder');
      expect(fileStorage.rename).toHaveBeenCalled();
    });

    it('moves folder to root when destinationPath is null', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.rename).mockResolvedValue(undefined);

      const result = await useCase.execute({
        sourcePath: 'nested/folder',
        destinationPath: null,
      });

      expect(result.newPath).toBe('folder');
    });

    it('throws error when source path is empty', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);

      await expect(useCase.execute({ sourcePath: '', destinationPath: null })).rejects.toThrow(
        'Source path is required',
      );
    });

    it('throws error when folder does not exist', async () => {
      const activeWorkspace = createWorkspaceProps({ isActive: true });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(activeWorkspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);

      await expect(
        useCase.execute({ sourcePath: 'nonexistent', destinationPath: null }),
      ).rejects.toThrow('Folder does not exist');
    });
  });

  describe('ScanWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let useCase: ScanWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      useCase = new ScanWorkspaceUseCase(workspaceRepo, fileStorage, createMockPathService());
    });

    it('scans workspace and returns file structure', async () => {
      const workspace = createWorkspaceProps({ folderPath: '/ws' });
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);

      // Mock glob results
      vi.mocked(fileStorage.glob).mockResolvedValue(['note1.md', 'folder/note2.md']);

      // Mock listFiles for structure building
      // Root level
      vi.mocked(fileStorage.listFiles).mockImplementation(async (path) => {
        if (path === '/ws') {
          return [
            {
              name: 'note1.md',
              path: '/ws/note1.md',
              isDirectory: false,
              size: 100,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
            {
              name: 'folder',
              path: '/ws/folder',
              isDirectory: true,
              size: 0,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
          ];
        }
        if (path === '/ws/folder') {
          return [
            {
              name: 'note2.md',
              path: '/ws/folder/note2.md',
              isDirectory: false,
              size: 100,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
          ];
        }
        return [];
      });

      const result = await useCase.execute({ workspaceId: 'ws-1' });

      expect(result.files).toHaveLength(2);
      expect(result.structure).toHaveLength(2); // note1.md + folder
      expect(result.total).toBe(2);
      expect(result.counts['__root__']).toBe(2);
      expect(result.counts['folder']).toBe(1);
    });

    it('throws WorkspaceNotFoundError', async () => {
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);
      await expect(useCase.execute({ workspaceId: 'nonexistent' })).rejects.toThrow(
        WorkspaceNotFoundError,
      );
    });
  });

  describe('SyncWorkspaceUseCase', () => {
    let workspaceRepo: IWorkspaceRepository;
    let noteRepo: INoteRepository;
    let fileStorage: IFileStorage;
    let markdownProcessor: IMarkdownProcessor;
    let useCase: SyncWorkspaceUseCase;

    beforeEach(() => {
      workspaceRepo = createMockWorkspaceRepository();
      noteRepo = createMockNoteRepository();
      fileStorage = createMockFileStorage();
      markdownProcessor = createMockMarkdownProcessor();
      useCase = new SyncWorkspaceUseCase(
        workspaceRepo,
        noteRepo,
        fileStorage,
        markdownProcessor,
        createMockIdGenerator(),
        createMockPathService(),
      );
    });

    it('syncs workspace files to database', async () => {
      const workspace = createWorkspaceProps({ folderPath: '/ws' });
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);

      // Mock glob results
      vi.mocked(fileStorage.glob).mockResolvedValue(['new.md', 'updated.md']);

      // Mock existing notes
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10000);
      vi.mocked(noteRepo.findAll).mockResolvedValue([
        { id: 'note-1', filePath: 'updated.md', title: 'Updated', updatedAt: oldDate, isDeleted: false } as any,
        { id: 'note-2', filePath: 'deleted.md', title: 'Deleted', updatedAt: now, isDeleted: false } as any,
      ]);

      // Mock file info
      vi.mocked(fileStorage.getFileInfo).mockResolvedValue({
        path: '/ws/test.md',
        name: 'test.md',
        modifiedAt: now,
        size: 100,
        createdAt: now,
        isDirectory: false,
      });

      // Mock file read
      vi.mocked(fileStorage.read).mockResolvedValue('# Test Content');

      // Mock save
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ workspaceId: 'ws-1' });

      expect(result.notes.created).toBe(1); // new.md
      expect(result.notes.updated).toBe(1); // updated.md
      expect(result.notes.deleted).toBe(1); // deleted.md

      // Verify save was called for each operation
      expect(noteRepo.save).toHaveBeenCalledTimes(3);
    });

    it('throws WorkspaceNotFoundError', async () => {
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);
      await expect(useCase.execute({ workspaceId: 'nonexistent' })).rejects.toThrow(
        WorkspaceNotFoundError,
      );
    });

    it('throws error when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);
      await expect(useCase.execute()).rejects.toThrow('No active workspace');
    });
  });
});
