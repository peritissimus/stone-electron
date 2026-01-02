/**
 * WorkspaceService Tests
 *
 * Unit tests for workspace management service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
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

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    workspace: mockWorkspaceRepo,
    notebook: mockNotebookRepo,
    note: mockNoteRepo,
  })),
}));

// Mock FileSystemService
const mockFileSystemService = {
  validateFolderPath: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  renameFolder: vi.fn(),
  fileExists: vi.fn(),
  scanFolder: vi.fn(),
  getFolderStructure: vi.fn(),
  generateUniqueFolderName: vi.fn(),
};

vi.mock('../../src/main/services/FileSystemService', () => ({
  getFileSystemService: vi.fn(() => mockFileSystemService),
}));

// Mock FileWatcherService
const mockFileWatcherService = {
  watchWorkspace: vi.fn(),
  unwatchWorkspace: vi.fn(),
};

vi.mock('../../src/main/services/FileWatcherService', () => ({
  getFileWatcherService: vi.fn(() => mockFileWatcherService),
}));

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
};

vi.mock('../../src/main/services/EventBus', () => ({
  getEventBus: vi.fn(() => mockEventBus),
}));

// Import after mocks
import { getWorkspaceService } from '../../src/main/services/WorkspaceService';

describe('WorkspaceService', () => {
  let workspaceService: ReturnType<typeof getWorkspaceService>;

  beforeEach(() => {
    vi.clearAllMocks();
    workspaceService = getWorkspaceService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createWorkspace', () => {
    it('should create a new workspace', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Test Workspace',
        folderPath: '/test/path',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileSystemService.validateFolderPath.mockResolvedValue({ valid: true });
      mockWorkspaceRepo.create.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(false);
      mockFileSystemService.createFolder.mockResolvedValue(undefined);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({ created: 0, updated: 0, errors: [] });
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({ created: 0, updated: 0, deleted: 0, errors: [] });
      mockFileWatcherService.watchWorkspace.mockResolvedValue(undefined);

      const result = await workspaceService.createWorkspace({
        name: 'Test Workspace',
        folderPath: '/test/path',
      });

      expect(result.name).toBe('Test Workspace');
      expect(mockWorkspaceRepo.create).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('workspaces:created', { workspace: mockWorkspace });
    });

    it('should throw error for invalid folder path', async () => {
      mockFileSystemService.validateFolderPath.mockResolvedValue({
        valid: false,
        error: 'Path does not exist',
      });

      await expect(
        workspaceService.createWorkspace({ name: 'Test', folderPath: '/invalid' }),
      ).rejects.toThrow('Path does not exist');
    });

    it('should create default folders in the workspace', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Test',
        folderPath: '/test',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileSystemService.validateFolderPath.mockResolvedValue({ valid: true });
      mockWorkspaceRepo.create.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(false);
      mockFileSystemService.createFolder.mockResolvedValue(undefined);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({ created: 0, updated: 0, errors: [] });
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({ created: 0, updated: 0, deleted: 0, errors: [] });

      await workspaceService.createWorkspace({ name: 'Test', folderPath: '/test' });

      // Should create Work, Journal, Personal folders
      expect(mockFileSystemService.createFolder).toHaveBeenCalledTimes(3);
    });
  });

  describe('getAllWorkspaces', () => {
    it('should return all workspaces', async () => {
      const mockWorkspaces = [
        { id: 'ws-1', name: 'Workspace 1' },
        { id: 'ws-2', name: 'Workspace 2' },
      ];
      mockWorkspaceRepo.findAll.mockResolvedValue(mockWorkspaces);

      const result = await workspaceService.getAllWorkspaces();

      expect(result).toEqual(mockWorkspaces);
    });
  });

  describe('getActiveWorkspace', () => {
    it('should return the active workspace', async () => {
      const mockWorkspace = { id: 'ws-1', name: 'Active', isActive: true };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);

      const result = await workspaceService.getActiveWorkspace();

      expect(result).toEqual(mockWorkspace);
    });

    it('should return null if no active workspace', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue(null);

      const result = await workspaceService.getActiveWorkspace();

      expect(result).toBeNull();
    });
  });

  describe('setActiveWorkspace', () => {
    it('should set the active workspace', async () => {
      const mockWorkspace = { id: 'ws-1', name: 'Test', isActive: true };
      mockWorkspaceRepo.setActive.mockResolvedValue(mockWorkspace);

      const result = await workspaceService.setActiveWorkspace('ws-1');

      expect(result).toEqual(mockWorkspace);
      expect(mockEventBus.emit).toHaveBeenCalledWith('workspaces:switched', { workspace: mockWorkspace });
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace name', async () => {
      const mockWorkspace = { id: 'ws-1', name: 'Updated Name' };
      mockWorkspaceRepo.update.mockResolvedValue(mockWorkspace);

      const result = await workspaceService.updateWorkspace('ws-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockEventBus.emit).toHaveBeenCalledWith('workspaces:updated', { workspace: mockWorkspace });
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace', async () => {
      mockWorkspaceRepo.delete.mockResolvedValue(undefined);
      mockFileWatcherService.unwatchWorkspace.mockResolvedValue(undefined);

      await workspaceService.deleteWorkspace('ws-1');

      expect(mockWorkspaceRepo.delete).toHaveBeenCalledWith('ws-1');
      expect(mockEventBus.emit).toHaveBeenCalledWith('workspaces:deleted', { id: 'ws-1' });
    });
  });

  describe('createFolder', () => {
    it('should create a folder in the workspace root', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.generateUniqueFolderName.mockResolvedValue('New Folder');
      mockFileSystemService.createFolder.mockResolvedValue(undefined);

      const result = await workspaceService.createFolder('New Folder');

      expect(result.folderPath).toBe('New Folder');
      expect(mockFileSystemService.createFolder).toHaveBeenCalled();
    });

    it('should create a folder in a subdirectory', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.generateUniqueFolderName.mockResolvedValue('Subfolder');
      mockFileSystemService.createFolder.mockResolvedValue(undefined);

      const result = await workspaceService.createFolder('Subfolder', 'Parent');

      expect(result.folderPath).toBe('Parent/Subfolder');
    });

    it('should throw error if no active workspace', async () => {
      mockWorkspaceRepo.getActive.mockResolvedValue(null);

      await expect(workspaceService.createFolder('Test')).rejects.toThrow('No active workspace');
    });
  });

  describe('renameFolder', () => {
    it('should rename a folder', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockFileSystemService.generateUniqueFolderName.mockResolvedValue('Renamed');
      mockFileSystemService.renameFolder.mockResolvedValue(undefined);

      const result = await workspaceService.renameFolder('OldName', 'Renamed');

      expect(result.folderPath).toBe('Renamed');
      expect(mockFileSystemService.renameFolder).toHaveBeenCalled();
    });

    it('should throw error if folder does not exist', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(false);

      await expect(workspaceService.renameFolder('NonExistent', 'NewName')).rejects.toThrow(
        'Folder does not exist',
      );
    });

    it('should throw error if folder path is empty', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);

      await expect(workspaceService.renameFolder('', 'NewName')).rejects.toThrow(
        'Folder path is required',
      );
    });
  });

  describe('deleteFolder', () => {
    it('should delete a folder', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockFileSystemService.deleteFolder.mockResolvedValue(undefined);

      await workspaceService.deleteFolder('FolderToDelete');

      expect(mockFileSystemService.deleteFolder).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('workspaces:updated', { workspace: mockWorkspace });
    });

    it('should throw error if folder does not exist', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(false);

      await expect(workspaceService.deleteFolder('NonExistent')).rejects.toThrow('Folder does not exist');
    });
  });

  describe('moveFolder', () => {
    it('should move a folder to a new location', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockFileSystemService.generateUniqueFolderName.mockResolvedValue('MovedFolder');
      mockFileSystemService.renameFolder.mockResolvedValue(undefined);

      const result = await workspaceService.moveFolder('SourceFolder', 'DestFolder');

      expect(result.folderPath).toBe('DestFolder/MovedFolder');
    });

    it('should throw error if source does not exist', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(false);

      await expect(workspaceService.moveFolder('NonExistent', 'Dest')).rejects.toThrow(
        'Source folder does not exist',
      );
    });

    it('should throw error when moving folder into itself', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(true);

      await expect(workspaceService.moveFolder('Parent', 'Parent/Child')).rejects.toThrow(
        'Cannot move a folder into itself',
      );
    });
  });

  describe('scanWorkspace', () => {
    it('should scan workspace and return files and structure', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      const mockFiles = [
        { relativePath: 'note1.md', path: '/workspace/note1.md' },
        { relativePath: 'folder/note2.md', path: '/workspace/folder/note2.md' },
      ];
      const mockStructure = [{ name: 'folder', type: 'folder' }];

      mockWorkspaceRepo.findById.mockResolvedValue(mockWorkspace);
      mockFileSystemService.scanFolder.mockResolvedValue(mockFiles);
      mockFileSystemService.getFolderStructure.mockResolvedValue(mockStructure);

      const result = await workspaceService.scanWorkspace('ws-1');

      expect(result.files).toEqual(mockFiles);
      expect(result.structure).toEqual(mockStructure);
      expect(result.total).toBe(2);
      expect(result.counts['__root__']).toBe(2);
      expect(result.counts['folder']).toBe(1);
    });

    it('should throw error if workspace not found', async () => {
      mockWorkspaceRepo.findById.mockResolvedValue(null);

      await expect(workspaceService.scanWorkspace('non-existent')).rejects.toThrow('Workspace not found');
    });
  });

  describe('syncWorkspace', () => {
    it('should sync workspace with filesystem', async () => {
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };
      mockWorkspaceRepo.findById.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({ created: 2, updated: 1, errors: [] });
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({ created: 5, updated: 3, deleted: 1, errors: [] });

      const result = await workspaceService.syncWorkspace('ws-1');

      expect(result.workspaceId).toBe('ws-1');
      expect(result.notebooks).toEqual({ created: 2, updated: 1, errors: [] });
      expect(result.notes).toEqual({ created: 5, updated: 3, deleted: 1, errors: [] });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should use active workspace if no ID provided', async () => {
      const mockWorkspace = { id: 'ws-active', folderPath: '/workspace' };
      mockWorkspaceRepo.getActive.mockResolvedValue(mockWorkspace);
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue({ created: 0, updated: 0, errors: [] });
      mockNoteRepo.syncWithFileSystem.mockResolvedValue({ created: 0, updated: 0, deleted: 0, errors: [] });

      const result = await workspaceService.syncWorkspace();

      expect(result.workspaceId).toBe('ws-active');
    });

    it('should throw error if workspace not found', async () => {
      mockWorkspaceRepo.findById.mockResolvedValue(null);

      await expect(workspaceService.syncWorkspace('non-existent')).rejects.toThrow('Workspace not found');
    });
  });

  describe('validatePath', () => {
    it('should return validation result', async () => {
      mockFileSystemService.validateFolderPath.mockResolvedValue({ valid: true });

      const result = await workspaceService.validatePath('/valid/path');

      expect(result.valid).toBe(true);
    });

    it('should return error for invalid path', async () => {
      mockFileSystemService.validateFolderPath.mockResolvedValue({
        valid: false,
        error: 'Path does not exist',
      });

      const result = await workspaceService.validatePath('/invalid');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path does not exist');
    });
  });

  describe('getWorkspaceService', () => {
    it('should return singleton instance', () => {
      const instance1 = getWorkspaceService();
      const instance2 = getWorkspaceService();

      expect(instance1).toBe(instance2);
    });
  });
});
