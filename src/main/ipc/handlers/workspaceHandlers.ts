/**
 * Workspace IPC Handlers
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { WORKSPACE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { getFileSystemService } from '../../services/FileSystemService';
import { getFileWatcherService } from '../../services/FileWatcherService';
import { createHandler, IpcError } from '../utils';

/**
 * Register all workspace handlers
 */
export function registerWorkspaceHandlers() {
  const repos = getRepositories();
  const fsService = getFileSystemService();

  // workspaces:selectFolder
  ipcMain.handle(
    WORKSPACE_CHANNELS.SELECT_FOLDER,
    createHandler(async (event) => {
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
  ipcMain.handle(
    WORKSPACE_CHANNELS.VALIDATE_PATH,
    createHandler(async (event, request: { folderPath: string }) => {
      return await fsService.validateFolderPath(request.folderPath);
    }),
  );

  // workspaces:create
  ipcMain.handle(
    WORKSPACE_CHANNELS.CREATE,
    createHandler(async (event, request: { name: string; folderPath: string }) => {
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
  ipcMain.handle(
    WORKSPACE_CHANNELS.GET_ALL,
    createHandler(async (event) => {
      const workspaces = await repos.workspace.findAll();
      return { workspaces };
    }),
  );

  // workspaces:getActive
  ipcMain.handle(
    WORKSPACE_CHANNELS.GET_ACTIVE,
    createHandler(async (event) => {
      const workspace = await repos.workspace.getActive();
      return { workspace };
    }),
  );

  // workspaces:setActive
  ipcMain.handle(
    WORKSPACE_CHANNELS.SET_ACTIVE,
    createHandler(async (event, request: { id: string }) => {
      const workspace = await repos.workspace.setActive(request.id);

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_SWITCHED, { workspace });
      });

      return workspace;
    }),
  );

  // workspaces:update
  ipcMain.handle(
    WORKSPACE_CHANNELS.UPDATE,
    createHandler(async (event, request: { id: string; name?: string }) => {
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

  ipcMain.handle(
    WORKSPACE_CHANNELS.CREATE_FOLDER,
    createHandler(async (event, request: { name: string; parentPath?: string }) => {
      const workspace = await repos.workspace.getActive();
      if (!workspace) {
        throw new IpcError('NOT_FOUND', 'Active workspace not found');
      }

      const parentRelativeRaw = request.parentPath || '';
      const parentRelative = parentRelativeRaw
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      const targetBase =
        parentRelative && parentRelative.length > 0
          ? path.join(workspace.folderPath, parentRelative)
          : workspace.folderPath;

      const folderName = await fsService.generateUniqueFolderName(
        targetBase,
        request.name || 'New Folder',
      );

      const newRelative =
        parentRelative && parentRelative.length > 0
          ? path.posix.join(parentRelative, folderName)
          : folderName;

      await fsService.createFolder(path.join(workspace.folderPath, newRelative));

      await repos.notebook.syncWithWorkspaceFolders(workspace.id);
      await repos.note.syncWithFileSystem(workspace.id);

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.WORKSPACE_UPDATED, { workspace });
      });

      return { folderPath: newRelative };
    }),
  );

  // workspaces:delete
  ipcMain.handle(
    WORKSPACE_CHANNELS.DELETE,
    createHandler(async (event, request: { id: string }) => {
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
  ipcMain.handle(
    WORKSPACE_CHANNELS.SCAN,
    createHandler(async (event, request: { workspaceId: string }) => {
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
  ipcMain.handle(
    WORKSPACE_CHANNELS.SYNC,
    createHandler(async (event, request: { workspaceId?: string }) => {
      const active = request?.workspaceId
        ? await repos.workspace.findById(request.workspaceId)
        : await repos.workspace.getActive();
      if (!active) throw new IpcError('NOT_FOUND', 'Active workspace not found');

      const start = Date.now();
      // Log start
      console.info(
        `[IPC][workspaces:sync] Start sync for workspace ${active.id} at ${active.folderPath}`,
      );

      // Sync notebooks from folders
      const nbResult = await repos.notebook.syncWithWorkspaceFolders(active.id);
      console.info(
        `[IPC][workspaces:sync] Notebook sync: created=${nbResult.created}, updated=${nbResult.updated}, errors=${nbResult.errors.length}`,
      );

      // Sync notes from files
      const noteResult = await repos.note.syncWithFileSystem(active.id);
      console.info(
        `[IPC][workspaces:sync] Note sync: created=${noteResult.created}, updated=${noteResult.updated}, deleted=${noteResult.deleted}, errors=${noteResult.errors.length}`,
      );

      const dur = Date.now() - start;
      console.info(`[IPC][workspaces:sync] Done in ${dur}ms`);

      return {
        workspaceId: active.id,
        notebooks: nbResult,
        notes: noteResult,
        durationMs: dur,
      };
    }),
  );
}
