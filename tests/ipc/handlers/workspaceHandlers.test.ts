/**
 * Workspace IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
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

// Mock WorkspaceService
const mockWorkspaceService = {
  createWorkspace: vi.fn(),
  getAllWorkspaces: vi.fn(),
  getActiveWorkspace: vi.fn(),
  setActiveWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  deleteFolder: vi.fn(),
  moveFolder: vi.fn(),
  scanWorkspace: vi.fn(),
  syncWorkspace: vi.fn(),
  validatePath: vi.fn(),
};

vi.mock('../../../src/main/services/WorkspaceService', () => ({
  getWorkspaceService: vi.fn(() => mockWorkspaceService),
}));

// Import after mocks
import { registerWorkspaceHandlers } from '../../../src/main/ipc/handlers/workspaceHandlers';
import { ipcMain, dialog } from 'electron';

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
      mockWorkspaceService.validatePath.mockResolvedValue({ valid: true });

      const handler = registeredHandlers.get('workspaces:validatePath');
      const result = await handler({}, { folderPath: '/valid/path' });

      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
      expect(mockWorkspaceService.validatePath).toHaveBeenCalledWith('/valid/path');
    });

    it('should return invalid for non-existent path', async () => {
      mockWorkspaceService.validatePath.mockResolvedValue({
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
    it('should create a workspace', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'My Workspace',
        folderPath: '/workspace/path',
      };
      mockWorkspaceService.createWorkspace.mockResolvedValue(mockWorkspace);

      const handler = registeredHandlers.get('workspaces:create');
      const result = await handler({}, {
        name: 'My Workspace',
        folderPath: '/workspace/path',
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('ws-1');
      expect(result.data.name).toBe('My Workspace');
      expect(mockWorkspaceService.createWorkspace).toHaveBeenCalledWith({
        name: 'My Workspace',
        folderPath: '/workspace/path',
      });
    });

    it('should throw error for invalid path', async () => {
      mockWorkspaceService.createWorkspace.mockRejectedValue(new Error('Path not writable'));

      const handler = registeredHandlers.get('workspaces:create');
      const result = await handler({}, {
        name: 'Test',
        folderPath: '/readonly/path',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PATH');
    });
  });

  describe('workspaces:getAll', () => {
    it('should return all workspaces', async () => {
      const workspaces = [
        { id: 'ws-1', name: 'Workspace 1' },
        { id: 'ws-2', name: 'Workspace 2' },
      ];
      mockWorkspaceService.getAllWorkspaces.mockResolvedValue(workspaces);

      const handler = registeredHandlers.get('workspaces:getAll');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.workspaces).toHaveLength(2);
    });
  });

  describe('workspaces:getActive', () => {
    it('should return active workspace', async () => {
      const workspace = { id: 'ws-1', name: 'Active Workspace', isActive: true };
      mockWorkspaceService.getActiveWorkspace.mockResolvedValue(workspace);

      const handler = registeredHandlers.get('workspaces:getActive');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.workspace.id).toBe('ws-1');
    });

    it('should return null if no active workspace', async () => {
      mockWorkspaceService.getActiveWorkspace.mockResolvedValue(null);

      const handler = registeredHandlers.get('workspaces:getActive');
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.data.workspace).toBeNull();
    });
  });

  describe('workspaces:setActive', () => {
    it('should set active workspace', async () => {
      const workspace = { id: 'ws-1', name: 'Test', isActive: true };
      mockWorkspaceService.setActiveWorkspace.mockResolvedValue(workspace);

      const handler = registeredHandlers.get('workspaces:setActive');
      const result = await handler({}, { id: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
      expect(mockWorkspaceService.setActiveWorkspace).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('workspaces:update', () => {
    it('should update workspace name', async () => {
      const workspace = { id: 'ws-1', name: 'Updated Name' };
      mockWorkspaceService.updateWorkspace.mockResolvedValue(workspace);

      const handler = registeredHandlers.get('workspaces:update');
      const result = await handler({}, { id: 'ws-1', name: 'Updated Name' });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
      expect(mockWorkspaceService.updateWorkspace).toHaveBeenCalledWith('ws-1', { name: 'Updated Name' });
    });
  });

  describe('workspaces:createFolder', () => {
    it('should create a folder in the active workspace', async () => {
      mockWorkspaceService.createFolder.mockResolvedValue({ folderPath: 'New Folder' });

      const handler = registeredHandlers.get('workspaces:createFolder');
      const result = await handler({}, { name: 'New Folder' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('New Folder');
      expect(mockWorkspaceService.createFolder).toHaveBeenCalledWith('New Folder', undefined);
    });

    it('should create a nested folder', async () => {
      mockWorkspaceService.createFolder.mockResolvedValue({ folderPath: 'Projects/Subfolder' });

      const handler = registeredHandlers.get('workspaces:createFolder');
      const result = await handler({}, { name: 'Subfolder', parentPath: 'Projects' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Projects/Subfolder');
    });

    it('should throw error if no active workspace', async () => {
      mockWorkspaceService.createFolder.mockRejectedValue(new Error('No active workspace'));

      const handler = registeredHandlers.get('workspaces:createFolder');
      const result = await handler({}, { name: 'New Folder' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('workspaces:renameFolder', () => {
    it('should rename a folder', async () => {
      mockWorkspaceService.renameFolder.mockResolvedValue({ folderPath: 'Renamed' });

      const handler = registeredHandlers.get('workspaces:renameFolder');
      const result = await handler({}, { path: 'OldName', name: 'Renamed' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Renamed');
      expect(mockWorkspaceService.renameFolder).toHaveBeenCalledWith('OldName', 'Renamed');
    });

    it('should throw error if folder does not exist', async () => {
      mockWorkspaceService.renameFolder.mockRejectedValue(new Error('Folder does not exist'));

      const handler = registeredHandlers.get('workspaces:renameFolder');
      const result = await handler({}, { path: 'NonExistent', name: 'New' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should throw error if path is empty', async () => {
      mockWorkspaceService.renameFolder.mockRejectedValue(new Error('Folder path is required'));

      const handler = registeredHandlers.get('workspaces:renameFolder');
      const result = await handler({}, { path: '', name: 'New' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('workspaces:deleteFolder', () => {
    it('should delete a folder', async () => {
      mockWorkspaceService.deleteFolder.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:deleteFolder');
      const result = await handler({}, { path: 'ToDelete' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockWorkspaceService.deleteFolder).toHaveBeenCalledWith('ToDelete');
    });

    it('should throw error if folder does not exist', async () => {
      mockWorkspaceService.deleteFolder.mockRejectedValue(new Error('Folder does not exist'));

      const handler = registeredHandlers.get('workspaces:deleteFolder');
      const result = await handler({}, { path: 'NonExistent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should throw error if path is empty', async () => {
      mockWorkspaceService.deleteFolder.mockRejectedValue(new Error('Folder path is required'));

      const handler = registeredHandlers.get('workspaces:deleteFolder');
      const result = await handler({}, { path: '' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('workspaces:moveFolder', () => {
    it('should move a folder to root', async () => {
      mockWorkspaceService.moveFolder.mockResolvedValue({ folderPath: 'Moved' });

      const handler = registeredHandlers.get('workspaces:moveFolder');
      const result = await handler({}, {
        sourcePath: 'Projects/Moved',
        destinationPath: null,
      });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Moved');
    });

    it('should move a folder to another folder', async () => {
      mockWorkspaceService.moveFolder.mockResolvedValue({ folderPath: 'Archive/Source' });

      const handler = registeredHandlers.get('workspaces:moveFolder');
      const result = await handler({}, {
        sourcePath: 'Source',
        destinationPath: 'Archive',
      });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Archive/Source');
    });

    it('should throw error if source does not exist', async () => {
      mockWorkspaceService.moveFolder.mockRejectedValue(new Error('Source folder does not exist'));

      const handler = registeredHandlers.get('workspaces:moveFolder');
      const result = await handler({}, {
        sourcePath: 'NonExistent',
        destinationPath: 'Archive',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should throw error when moving folder into itself', async () => {
      mockWorkspaceService.moveFolder.mockRejectedValue(new Error('Cannot move a folder into itself'));

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
      mockWorkspaceService.deleteWorkspace.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('workspaces:delete');
      const result = await handler({}, { id: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.id).toBe('ws-1');
      expect(mockWorkspaceService.deleteWorkspace).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('workspaces:scan', () => {
    it('should scan workspace for files', async () => {
      const scanResult = {
        files: [
          { relativePath: 'Personal/note1.md', path: '/workspace/Personal/note1.md' },
          { relativePath: 'Work/note2.md', path: '/workspace/Work/note2.md' },
        ],
        structure: { name: 'workspace', children: [] },
        total: 2,
        counts: { '__root__': 2, 'Personal': 1, 'Work': 1 },
      };
      mockWorkspaceService.scanWorkspace.mockResolvedValue(scanResult);

      const handler = registeredHandlers.get('workspaces:scan');
      const result = await handler({}, { workspaceId: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(2);
      expect(result.data.total).toBe(2);
      expect(mockWorkspaceService.scanWorkspace).toHaveBeenCalledWith('ws-1');
    });

    it('should throw error if workspace not found', async () => {
      mockWorkspaceService.scanWorkspace.mockRejectedValue(new Error('Workspace not found'));

      const handler = registeredHandlers.get('workspaces:scan');
      const result = await handler({}, { workspaceId: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('workspaces:sync', () => {
    it('should sync workspace', async () => {
      const syncResult = {
        workspaceId: 'ws-1',
        notebooks: { created: 2, updated: 1, errors: [] },
        notes: { created: 5, updated: 3, deleted: 0, errors: [] },
        durationMs: 100,
      };
      mockWorkspaceService.syncWorkspace.mockResolvedValue(syncResult);

      const handler = registeredHandlers.get('workspaces:sync');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.workspaceId).toBe('ws-1');
      expect(result.data.notebooks).toEqual({ created: 2, updated: 1, errors: [] });
    });

    it('should sync specific workspace by id', async () => {
      const syncResult = {
        workspaceId: 'ws-2',
        notebooks: { created: 0, updated: 0, errors: [] },
        notes: { created: 0, updated: 0, deleted: 0, errors: [] },
        durationMs: 50,
      };
      mockWorkspaceService.syncWorkspace.mockResolvedValue(syncResult);

      const handler = registeredHandlers.get('workspaces:sync');
      const result = await handler({}, { workspaceId: 'ws-2' });

      expect(result.success).toBe(true);
      expect(result.data.workspaceId).toBe('ws-2');
      expect(mockWorkspaceService.syncWorkspace).toHaveBeenCalledWith('ws-2');
    });

    it('should throw error if workspace not found', async () => {
      mockWorkspaceService.syncWorkspace.mockRejectedValue(new Error('Workspace not found'));

      const handler = registeredHandlers.get('workspaces:sync');
      const result = await handler({}, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });
});
