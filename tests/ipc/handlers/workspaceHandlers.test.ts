/**
 * Workspace IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      { webContents: { send: vi.fn() } },
    ]),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({
      canceled: false,
      filePaths: ['/selected/folder'],
    })),
  },
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock path utilities
vi.mock('../../../src/main/utils/path', () => ({
  resolveInsideRoot: vi.fn((root: string, rel: string) =>
    rel === '.' ? root : `${root}/${rel}`
  ),
  normalizeRelativePath: vi.fn((input: string) => input?.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || ''),
}));

// Mock repositories
const mockWorkspaceRepo = {
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  getActive: vi.fn(),
  setActive: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockNotebookRepo = {
  syncWithWorkspaceFolders: vi.fn(),
};

const mockNoteRepo = {
  syncWithFileSystem: vi.fn(),
};

vi.mock('../../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    workspace: mockWorkspaceRepo,
    notebook: mockNotebookRepo,
    note: mockNoteRepo,
  })),
}));

// Mock file system service
const mockFsService = {
  validateFolderPath: vi.fn(),
  createFolder: vi.fn(),
  fileExists: vi.fn(),
  deleteFolder: vi.fn(),
  renameFolder: vi.fn(),
  scanFolder: vi.fn(),
  getFolderStructure: vi.fn(),
  generateUniqueFolderName: vi.fn(),
};

vi.mock('../../../src/main/services/FileSystemService', () => ({
  getFileSystemService: vi.fn(() => mockFsService),
}));

// Mock file watcher service
const mockFileWatcherService = {
  watchWorkspace: vi.fn(),
  unwatchWorkspace: vi.fn(),
};

vi.mock('../../../src/main/services/FileWatcherService', () => ({
  getFileWatcherService: vi.fn(() => mockFileWatcherService),
}));

// Import after mocks
import { registerWorkspaceHandlers } from '../../../src/main/ipc/handlers/workspaceHandlers';
import { ipcMain, BrowserWindow, dialog } from 'electron';

describe('Workspace IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerWorkspaceHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('workspaces:selectFolder', () => {
    it('should return selected folder path', async () => {
      (dialog.showOpenDialog as any).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/folder'],
      });

      const handler = registeredHandlers.get('workspaces:selectFolder');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.canceled).toBe(false);
      expect(result.data.folderPath).toBe('/path/to/folder');
    });

    it('should return canceled when dialog is canceled', async () => {
      (dialog.showOpenDialog as any).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const handler = registeredHandlers.get('workspaces:selectFolder');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.canceled).toBe(true);
    });
  });

  describe('workspaces:validatePath', () => {
    it('should validate folder path', async () => {
      mockFsService.validateFolderPath.mockResolvedValue({
        valid: true,
        readable: true,
        writable: true,
      });

      const handler = registeredHandlers.get('workspaces:validatePath');
      const result = await handler({}, { folderPath: '/valid/path' });

      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
      expect(mockFsService.validateFolderPath).toHaveBeenCalledWith('/valid/path');
    });

    it('should return invalid for non-existent path', async () => {
      mockFsService.validateFolderPath.mockResolvedValue({
        valid: false,
        error: 'Path does not exist',
      });

      const handler = registeredHandlers.get('workspaces:validatePath');
      const result = await handler({}, { folderPath: '/invalid/path' });

      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(false);
      expect(result.data.error).toBe('Path does not exist');
    });
  });

  describe('workspaces:create', () => {
    it('should create a workspace with default folders', async () => {
      mockFsService.validateFolderPath.mockResolvedValue({ valid: true });
      mockWorkspaceRepo.create.mockResolvedValue({
        id: 'ws-1',
        name: 'My Workspace',
        folderPath: '/workspace/path',
      });
      mockFsService.createFolder.mockResolvedValue(undefined);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({ created: 3 });
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({ created: 0, updated: 0 });
      mockFileWatcherService.watchWorkspace.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:create');
      const result = await handler({}, {
        name: 'My Workspace',
        folderPath: '/workspace/path',
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('ws-1');
      expect(result.data.name).toBe('My Workspace');
      expect(mockFsService.createFolder).toHaveBeenCalledTimes(3); // Work, Journal, Personal
    });

    it('should throw error for invalid path', async () => {
      mockFsService.validateFolderPath.mockResolvedValue({
        valid: false,
        error: 'Path not writable',
      });

      const handler = registeredHandlers.get('workspaces:create');
      const result = await handler({}, {
        name: 'Test',
        folderPath: '/readonly/path',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PATH');
    });

    it('should broadcast workspace created event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockFsService.validateFolderPath.mockResolvedValue({ valid: true });
      mockWorkspaceRepo.create.mockResolvedValue({ id: 'ws-1', name: 'Test' });
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({});

      const handler = registeredHandlers.get('workspaces:create');
      await handler({}, { name: 'Test', folderPath: '/path' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'workspaces:created',
        expect.objectContaining({ workspace: expect.any(Object) })
      );
    });

    it('should start watching the new workspace', async () => {
      mockFsService.validateFolderPath.mockResolvedValue({ valid: true });
      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/path' };
      mockWorkspaceRepo.create.mockResolvedValue(workspace);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({});

      const handler = registeredHandlers.get('workspaces:create');
      await handler({}, { name: 'Test', folderPath: '/path' });

      expect(mockFileWatcherService.watchWorkspace).toHaveBeenCalledWith(workspace);
    });
  });

  describe('workspaces:getAll', () => {
    it('should return all workspaces', async () => {
      const workspaces = [
        { id: 'ws-1', name: 'Workspace 1' },
        { id: 'ws-2', name: 'Workspace 2' },
      ];
      mockWorkspaceRepo.findAll.mockResolvedValue(workspaces);

      const handler = registeredHandlers.get('workspaces:getAll');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.workspaces).toHaveLength(2);
    });
  });

  describe('workspaces:getActive', () => {
    it('should return active workspace', async () => {
      const workspace = { id: 'ws-1', name: 'Active Workspace', isActive: true };
      mockWorkspaceRepo.getActive.mockResolvedValue(workspace);

      const handler = registeredHandlers.get('workspaces:getActive');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.workspace.id).toBe('ws-1');
      expect(result.data.workspace.isActive).toBe(true);
    });

    it('should return null if no active workspace', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue(null);

      const handler = registeredHandlers.get('workspaces:getActive');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.workspace).toBeNull();
    });
  });

  describe('workspaces:setActive', () => {
    it('should set active workspace', async () => {
      const workspace = { id: 'ws-1', name: 'Test', isActive: true };
      mockWorkspaceRepo.setActive.mockResolvedValue(workspace);

      const handler = registeredHandlers.get('workspaces:setActive');
      const result = await handler({}, { id: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
      expect(mockWorkspaceRepo.setActive).toHaveBeenCalledWith('ws-1');
    });

    it('should broadcast workspace switched event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockWorkspaceRepo.setActive.mockResolvedValue({ id: 'ws-1', name: 'Test' });

      const handler = registeredHandlers.get('workspaces:setActive');
      await handler({}, { id: 'ws-1' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'workspaces:switched',
        expect.objectContaining({ workspace: expect.any(Object) })
      );
    });
  });

  describe('workspaces:update', () => {
    it('should update workspace name', async () => {
      const workspace = { id: 'ws-1', name: 'Updated Name' };
      mockWorkspaceRepo.update.mockResolvedValue(workspace);

      const handler = registeredHandlers.get('workspaces:update');
      const result = await handler({}, { id: 'ws-1', name: 'Updated Name' });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
      expect(mockWorkspaceRepo.update).toHaveBeenCalledWith('ws-1', { name: 'Updated Name' });
    });

    it('should broadcast workspace updated event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockWorkspaceRepo.update.mockResolvedValue({ id: 'ws-1', name: 'Test' });

      const handler = registeredHandlers.get('workspaces:update');
      await handler({}, { id: 'ws-1', name: 'Test' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'workspaces:updated',
        expect.objectContaining({ workspace: expect.any(Object) })
      );
    });
  });

  describe('workspaces:createFolder', () => {
    it('should create a folder in the active workspace', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.generateUniqueFolderName.mockResolvedValue('New Folder');
      mockFsService.createFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:createFolder');
      const result = await handler({}, { name: 'New Folder' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('New Folder');
    });

    it('should create a nested folder', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.generateUniqueFolderName.mockResolvedValue('Subfolder');
      mockFsService.createFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:createFolder');
      const result = await handler({}, { name: 'Subfolder', parentPath: 'Projects' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Projects/Subfolder');
    });

    it('should throw error if no active workspace', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue(null);

      const handler = registeredHandlers.get('workspaces:createFolder');
      const result = await handler({}, { name: 'New Folder' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('workspaces:renameFolder', () => {
    it('should rename a folder', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockFsService.generateUniqueFolderName.mockResolvedValue('Renamed');
      mockFsService.renameFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:renameFolder');
      const result = await handler({}, { path: 'OldName', name: 'Renamed' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Renamed');
    });

    it('should rename a nested folder', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockFsService.generateUniqueFolderName.mockResolvedValue('NewName');
      mockFsService.renameFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:renameFolder');
      const result = await handler({}, { path: 'Projects/OldName', name: 'NewName' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Projects/NewName');
    });

    it('should throw error if folder does not exist', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(false);

      const handler = registeredHandlers.get('workspaces:renameFolder');
      const result = await handler({}, { path: 'NonExistent', name: 'New' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should throw error if path is empty', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });

      const handler = registeredHandlers.get('workspaces:renameFolder');
      const result = await handler({}, { path: '', name: 'New' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('workspaces:deleteFolder', () => {
    it('should delete a folder', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockFsService.deleteFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:deleteFolder');
      const result = await handler({}, { path: 'ToDelete' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockFsService.deleteFolder).toHaveBeenCalled();
    });

    it('should throw error if folder does not exist', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(false);

      const handler = registeredHandlers.get('workspaces:deleteFolder');
      const result = await handler({}, { path: 'NonExistent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should throw error if path is empty', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });

      const handler = registeredHandlers.get('workspaces:deleteFolder');
      const result = await handler({}, { path: '' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('workspaces:moveFolder', () => {
    it('should move a folder to root', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockFsService.generateUniqueFolderName.mockResolvedValue('Moved');
      mockFsService.renameFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:moveFolder');
      const result = await handler({}, {
        sourcePath: 'Projects/Moved',
        destinationPath: null,
      });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Moved');
    });

    it('should move a folder to another folder', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockFsService.generateUniqueFolderName.mockResolvedValue('Source');
      mockFsService.renameFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:moveFolder');
      const result = await handler({}, {
        sourcePath: 'Source',
        destinationPath: 'Archive',
      });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Archive/Source');
    });

    it('should throw error if source does not exist', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValueOnce(false); // source check

      const handler = registeredHandlers.get('workspaces:moveFolder');
      const result = await handler({}, {
        sourcePath: 'NonExistent',
        destinationPath: 'Archive',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should throw error when moving folder into itself', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);

      const handler = registeredHandlers.get('workspaces:moveFolder');
      const result = await handler({}, {
        sourcePath: 'Parent',
        destinationPath: 'Parent/Child',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('workspaces:delete', () => {
    it('should delete a workspace', async () => {
      mockWorkspaceRepo.delete.mockResolvedValue(undefined);
      mockFileWatcherService.unwatchWorkspace.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:delete');
      const result = await handler({}, { id: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.id).toBe('ws-1');
    });

    it('should stop watching the deleted workspace', async () => {
      mockWorkspaceRepo.delete.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:delete');
      await handler({}, { id: 'ws-1' });

      expect(mockFileWatcherService.unwatchWorkspace).toHaveBeenCalledWith('ws-1');
    });

    it('should broadcast workspace deleted event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockWorkspaceRepo.delete.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:delete');
      await handler({}, { id: 'ws-1' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'workspaces:deleted',
        { id: 'ws-1' }
      );
    });
  });

  describe('workspaces:scan', () => {
    it('should scan workspace for files', async () => {
      mockWorkspaceRepo.findById.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.scanFolder.mockResolvedValue([
        { relativePath: 'Personal/note1.md' },
        { relativePath: 'Work/note2.md' },
      ]);
      mockFsService.getFolderStructure.mockResolvedValue({
        name: 'workspace',
        children: [],
      });

      const handler = registeredHandlers.get('workspaces:scan');
      const result = await handler({}, { workspaceId: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(2);
      expect(result.data.total).toBe(2);
      expect(result.data.counts['__root__']).toBe(2);
      expect(result.data.counts['Personal']).toBe(1);
      expect(result.data.counts['Work']).toBe(1);
    });

    it('should throw error if workspace not found', async () => {
      mockWorkspaceRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('workspaces:scan');
      const result = await handler({}, { workspaceId: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should broadcast workspace scanned event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockWorkspaceRepo.findById.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.scanFolder.mockResolvedValue([]);
      mockFsService.getFolderStructure.mockResolvedValue({ name: 'workspace' });

      const handler = registeredHandlers.get('workspaces:scan');
      await handler({}, { workspaceId: 'ws-1' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'workspaces:scanned',
        expect.objectContaining({ workspace: expect.any(Object) })
      );
    });
  });

  describe('workspaces:sync', () => {
    it('should sync active workspace', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({
        created: 2,
        updated: 1,
      });
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({
        created: 5,
        updated: 3,
      });

      const handler = registeredHandlers.get('workspaces:sync');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.workspaceId).toBe('ws-1');
      expect(result.data.notebooks).toEqual({ created: 2, updated: 1 });
      expect(result.data.notes).toEqual({ created: 5, updated: 3 });
    });

    it('should sync specific workspace by id', async () => {
      mockWorkspaceRepo.findById.mockResolvedValue({
        id: 'ws-2',
        folderPath: '/other-workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({});

      const handler = registeredHandlers.get('workspaces:sync');
      const result = await handler({}, { workspaceId: 'ws-2' });

      expect(result.success).toBe(true);
      expect(result.data.workspaceId).toBe('ws-2');
      expect(mockWorkspaceRepo.findById).toHaveBeenCalledWith('ws-2');
    });

    it('should throw error if no active workspace', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue(null);

      const handler = registeredHandlers.get('workspaces:sync');
      const result = await handler({}, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should ensure default folders exist', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(false);
      mockFsService.createFolder.mockResolvedValue(undefined);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({ created: 0, updated: 0 });

      const handler = registeredHandlers.get('workspaces:sync');
      await handler({}, {});

      // Should try to create Work, Journal, Personal folders
      expect(mockFsService.createFolder).toHaveBeenCalledTimes(3);
    });

    it('should include duration in result', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      });
      mockFsService.fileExists.mockResolvedValue(true);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({ created: 0, updated: 0 });

      const handler = registeredHandlers.get('workspaces:sync');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
