/**
 * Workspace IPC Handlers
 */

import { BrowserWindow, dialog } from 'electron';
import path from 'path';
import { WORKSPACE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { getFileSystemService } from '../../services/FileSystemService';
import { getFileWatcherService } from '../../services/FileWatcherService';
import { registerHandler, IpcError } from '../utils';
import { resolveInsideRoot, normalizeRelativePath as normalizeRelUtil } from '../../utils/path';
import { logger } from '../../utils/logger';

/**
 * Register all workspace handlers
 */
export function registerWorkspaceHandlers() {
  const repos = getRepositories();
  const fsService = getFileSystemService();
  const normalizeRelativePath = (input?: string) => normalizeRelUtil(input || '');
  const getParentRelativePath = (relative: string) => {
    const normalized = normalizeRelativePath(relative);
    if (!normalized.includes('/')) {
      return '';
    }
    return normalized.slice(0, normalized.lastIndexOf('/'));
  };

  // workspaces:selectFolder
  registerHandler(
    WORKSPACE_CHANNELS.SELECT_FOLDER,
    async (event) => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Workspace Folder',
        buttonLabel: 'Select Folder',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      return {
        canceled: false,
        folderPath: result.filePaths[0],
      };
    }),
  );

  // workspaces:validatePath
  registerHandler(
    WORKSPACE_CHANNELS.VALIDATE_PATH,
    async (event, request: { folderPath: string }) => {
      return await fsService.validateFolderPath(request.folderPath);
    }),
  );

  // workspaces:create
  registerHandler(
    WORKSPACE_CHANNELS.CREATE,
    async (event, request: { name: string; folderPath: string }) => {
      // Validate folder path
      const validation = await fsService.validateFolderPath(request.folderPath);
      if (!validation.valid) {
        throw new IpcError('INVALID_PATH', validation.error || 'Invalid folder path');
      }

      // Create workspace
      const workspace = await repos.workspace.create({
        name: request.name,
        folderPath: request.folderPath,
      });

      // Create default folders: Work, Journal, Personal
      const defaultFolders = ['Work', 'Journal', 'Personal'];
      for (const folderName of defaultFolders) {
        try {
          const folderPath = path.join(request.folderPath, folderName);
          await fsService.createFolder(folderPath);
        } catch (error) {
          // Folder may already exist - that's fine
        }
      }

      // Sync notebooks and notes after creating default folders
      try {
        await repos.notebook.syncWithWorkspaceFolders(workspace.id);
        await repos.note.syncWithFileSystem(workspace.id);
      } catch (error) {
        logger.error('[Workspace] Error syncing after creating default folders:', error);
      }

      // Start watching the new workspace
      try {
        await getFileWatcherService().watchWorkspace(workspace);
      } catch (e) {
        // Non-fatal: watcher failure should not block workspace creation
      }

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_CREATED, { workspace });
      });

      return workspace;
    }),
  );

  // workspaces:getAll
  registerHandler(
    WORKSPACE_CHANNELS.GET_ALL,
    async (event) => {
      const workspaces = await repos.workspace.findAll();
      return { workspaces };
    }),
  );

  // workspaces:getActive
  registerHandler(
    WORKSPACE_CHANNELS.GET_ACTIVE,
    async (event) => {
      const workspace = await repos.workspace.getActive();
      return { workspace };
    }),
  );

  // workspaces:setActive
  registerHandler(
    WORKSPACE_CHANNELS.SET_ACTIVE,
    async (event, request: { id: string }) => {
      const workspace = await repos.workspace.setActive(request.id);

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_SWITCHED, { workspace });
      });

      return workspace;
    }),
  );

  // workspaces:update
  registerHandler(
    WORKSPACE_CHANNELS.UPDATE,
    async (event, request: { id: string; name?: string }) => {
      const workspace = await repos.workspace.update(request.id, {
        name: request.name,
      });

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_UPDATED, { workspace });
      });

      return workspace;
    }),
  );

  registerHandler(
    WORKSPACE_CHANNELS.CREATE_FOLDER,
    async (event, request: { name: string; parentPath?: string }) => {
      const workspace = await repos.workspace.getActive();
      if (!workspace) {
        throw new IpcError('NOT_FOUND', 'Active workspace not found');
      }

      const parentRelative = normalizeRelativePath(request.parentPath || '');

      const targetBase = resolveInsideRoot(
        workspace.folderPath,
        parentRelative && parentRelative.length > 0 ? parentRelative : '.',
      );

      const folderName = await fsService.generateUniqueFolderName(
        targetBase,
        request.name || 'New Folder',
      );

      const newRelative =
        parentRelative && parentRelative.length > 0
          ? path.posix.join(parentRelative, folderName)
          : folderName;

      await fsService.createFolder(resolveInsideRoot(workspace.folderPath, newRelative));

      // FileWatcher will handle sync automatically - no manual sync needed

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_UPDATED, { workspace });
      });

      return { folderPath: newRelative };
    }),
  );

  registerHandler(
    WORKSPACE_CHANNELS.RENAME_FOLDER,
    async (event, request: { path: string; name: string }) => {
      const workspace = await repos.workspace.getActive();
      if (!workspace) {
        throw new IpcError('NOT_FOUND', 'Active workspace not found');
      }

      const targetRelative = normalizeRelativePath(request.path);
      if (!targetRelative) {
        throw new IpcError('INVALID_INPUT', 'Folder path is required');
      }

      const currentAbsolute = resolveInsideRoot(workspace.folderPath, targetRelative);
      const exists = await fsService.fileExists(currentAbsolute);
      if (!exists) {
        throw new IpcError('NOT_FOUND', 'Folder does not exist');
      }

      const parentRelative = getParentRelativePath(targetRelative);
      const parentAbsolute = resolveInsideRoot(
        workspace.folderPath,
        parentRelative ? parentRelative : '.',
      );

      const desiredName = request.name && request.name.trim().length > 0 ? request.name : 'Folder';
      const newFolderName = await fsService.generateUniqueFolderName(
        parentAbsolute,
        desiredName,
        currentAbsolute,
      );

      const newRelative = parentRelative
        ? path.posix.join(parentRelative, newFolderName)
        : newFolderName;
      const newAbsolute = resolveInsideRoot(workspace.folderPath, newRelative);

      if (newAbsolute !== currentAbsolute) {
        await fsService.renameFolder(currentAbsolute, newAbsolute);
      }

      // FileWatcher will handle sync automatically - no manual sync needed

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_UPDATED, { workspace });
      });

      return { folderPath: newRelative };
    }),
  );

  registerHandler(
    WORKSPACE_CHANNELS.DELETE_FOLDER,
    async (event, request: { path: string }) => {
      const workspace = await repos.workspace.getActive();
      if (!workspace) {
        throw new IpcError('NOT_FOUND', 'Active workspace not found');
      }

      const targetRelative = normalizeRelativePath(request.path);
      if (!targetRelative) {
        throw new IpcError('INVALID_INPUT', 'Folder path is required');
      }

      const targetAbsolute = resolveInsideRoot(workspace.folderPath, targetRelative);
      const exists = await fsService.fileExists(targetAbsolute);
      if (!exists) {
        throw new IpcError('NOT_FOUND', 'Folder does not exist');
      }

      await fsService.deleteFolder(targetAbsolute, true);

      // FileWatcher will handle sync automatically - no manual sync needed

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_UPDATED, { workspace });
      });

      return { success: true };
    }),
  );

  registerHandler(
    WORKSPACE_CHANNELS.MOVE_FOLDER,
    async (event, request: { sourcePath: string; destinationPath: string | null }) => {
      const workspace = await repos.workspace.getActive();
      if (!workspace) {
        throw new IpcError('NOT_FOUND', 'Active workspace not found');
      }

      const sourceRelative = normalizeRelativePath(request.sourcePath);
      if (!sourceRelative) {
        throw new IpcError('INVALID_INPUT', 'Source folder path is required');
      }

      const sourceAbsolute = resolveInsideRoot(workspace.folderPath, sourceRelative);
      const exists = await fsService.fileExists(sourceAbsolute);
      if (!exists) {
        throw new IpcError('NOT_FOUND', 'Source folder does not exist');
      }

      const destinationRelative = normalizeRelativePath(request.destinationPath || '');
      const destinationAbsolute = resolveInsideRoot(
        workspace.folderPath,
        destinationRelative || '.',
      );

      // Check if destination exists and is a directory
      const destExists = await fsService.fileExists(destinationAbsolute);
      if (destinationRelative && !destExists) {
        throw new IpcError('NOT_FOUND', 'Destination folder does not exist');
      }

      // Prevent moving a folder into itself or its subdirectory
      if (destinationRelative.startsWith(sourceRelative + '/')) {
        throw new IpcError('INVALID_INPUT', 'Cannot move a folder into itself or its subdirectory');
      }

      const folderName = path.basename(sourceRelative);
      const newRelative = destinationRelative
        ? path.posix.join(destinationRelative, folderName)
        : folderName;

      // Generate unique name if there's a conflict
      const uniqueName = await fsService.generateUniqueFolderName(
        destinationAbsolute,
        folderName,
      );
      const finalRelative = destinationRelative
        ? path.posix.join(destinationRelative, uniqueName)
        : uniqueName;
      const finalAbsolute = resolveInsideRoot(workspace.folderPath, finalRelative);

      // Move the folder
      await fsService.renameFolder(sourceAbsolute, finalAbsolute);

      // FileWatcher will handle sync automatically - no manual sync needed

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_UPDATED, { workspace });
      });

      return { folderPath: finalRelative };
    },
  );

  // workspaces:delete
  registerHandler(
    WORKSPACE_CHANNELS.DELETE,
    async (event, request: { id: string }) => {
      await repos.workspace.delete(request.id);

      // Stop watching removed workspace
      try {
        await getFileWatcherService().unwatchWorkspace(request.id);
      } catch (e) {}

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_DELETED, { id: request.id });
      });

      return { success: true, id: request.id };
    }),
  );

  // workspaces:scan
  registerHandler(
    WORKSPACE_CHANNELS.SCAN,
    async (event, request: { workspaceId: string }) => {
      const workspace = await repos.workspace.findById(request.workspaceId);
      if (!workspace) {
        throw new IpcError('NOT_FOUND', 'Workspace not found');
      }

      // Scan folder for markdown files
      const files = await fsService.scanFolder(workspace.folderPath, true);
      const counts: Record<string, number> = {};

      files.forEach((file) => {
        const normalized = file.relativePath.replace(/\\/g, '/');
        const segments = normalized.split('/');

        const folderSegments = segments.length > 1 ? segments.slice(0, -1) : [];
        const prefixes: string[] = ['__root__'];
        let current = '';
        folderSegments.forEach((segment) => {
          current = current ? `${current}/${segment}` : segment;
          prefixes.push(current);
        });

        prefixes.forEach((prefix) => {
          counts[prefix] = (counts[prefix] || 0) + 1;
        });
      });

      // Get folder structure
      const structure = await fsService.getFolderStructure(workspace.folderPath);

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_SCANNED, {
          workspace,
          files,
          structure,
        });
      });

      return {
        files,
        structure,
        total: files.length,
        counts,
      };
    }),
  );

  // workspaces:sync - sync folders->notebooks and files->notes
  registerHandler(
    WORKSPACE_CHANNELS.SYNC,
    async (event, request: { workspaceId?: string }) => {
      const active = request?.workspaceId
        ? await repos.workspace.findById(request.workspaceId)
        : await repos.workspace.getActive();
      if (!active) throw new IpcError('NOT_FOUND', 'Active workspace not found');

      const start = Date.now();

      // Ensure default folders exist (Work, Journal, Personal)
      const defaultFolders = ['Work', 'Journal', 'Personal'];
      for (const folderName of defaultFolders) {
        try {
          const folderPath = path.join(active.folderPath, folderName);
          const exists = await fsService.fileExists(folderPath);
          if (!exists) {
            await fsService.createFolder(folderPath);
          }
        } catch (error) {
          logger.warn(`[IPC] workspaces:sync - Could not create folder ${folderName}:`, error);
        }
      }

      // Sync notebooks from folders
      const nbResult = await repos.notebook.syncWithWorkspaceFolders(active.id);

      // Sync notes from files
      const noteResult = await repos.note.syncWithFileSystem(active.id);

      const dur = Date.now() - start;
      logger.info(`[IPC] workspaces:sync → ${noteResult.created + noteResult.updated} notes synced (${dur}ms)`);

      return {
        workspaceId: active.id,
        notebooks: nbResult,
        notes: noteResult,
        durationMs: dur,
      };
    }),
  );
}
