/**
 * Workspace IPC Adapter
 *
 * Every handler parses its request payload via a shared Zod schema at
 * the boundary and binds its return type to the response schema the
 * renderer expects — so wire-shape drift between the main process use
 * cases and the renderer is a compile-time error.
 */

import { ipcMain } from 'electron';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  CreateFolderRequestSchema,
  CreateWorkspaceRequestSchema,
  DeleteFolderRequestSchema,
  MoveFolderRequestSchema,
  RenameFolderRequestSchema,
  ScanWorkspaceRequestSchema,
  SelectFolderRequestSchema,
  SyncWorkspaceRequestSchema,
  UpdateWorkspaceRequestSchema,
  ValidatePathRequestSchema,
  WorkspaceIdRequestSchema,
  type FolderPathResponse,
  type GetActiveWorkspaceResponse,
  type ListWorkspacesResponse,
  type ScanWorkspaceResponse,
  type SelectFolderResponse,
  type SyncWorkspaceResponse,
  type ValidatePathResponse,
  type WorkspaceResponse,
} from '@shared/schemas';
import type { IWorkspaceUseCases } from '../../../domain';
import { logger } from '../../../shared';
import {
  COMMON_IPC_ERROR_MAP,
  handleIpcRequest,
  type IPCResponse,
} from '@main/shared/utils';

export interface WorkspaceIPCDeps {
  workspaceUseCases: IWorkspaceUseCases;
}

export class WorkspaceIPC {
  constructor(private readonly deps: WorkspaceIPCDeps) {}

  registerHandlers(): void {
    const { workspaceUseCases } = this.deps;

    ipcMain.handle(WORKSPACE_CHANNELS.CREATE, async (_event, rawRequest) => {
      const { name, path, folderPath } = CreateWorkspaceRequestSchema.parse(rawRequest);
      const resolvedFolderPath = folderPath ?? path!;
      return this.handleRequest<WorkspaceResponse>(
        async () => {
          const result = await workspaceUseCases.createWorkspace.execute({
            name,
            folderPath: resolvedFolderPath,
          });
          return result.workspace;
        },
        {
          channel: WORKSPACE_CHANNELS.CREATE,
          workspaceName: name,
          folderPath: resolvedFolderPath,
        },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.GET_ALL, async () => {
      return this.handleRequest<ListWorkspacesResponse>(
        async () => {
          const result = await workspaceUseCases.listWorkspaces.execute();
          return { workspaces: result.workspaces };
        },
        { channel: WORKSPACE_CHANNELS.GET_ALL },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.DELETE, async (_event, rawRequest) => {
      const { id } = WorkspaceIdRequestSchema.parse(rawRequest);
      return this.handleRequest<void>(
        async () => {
          await workspaceUseCases.deleteWorkspace.execute({ id });
        },
        { channel: WORKSPACE_CHANNELS.DELETE, workspaceId: id },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.SET_ACTIVE, async (_event, rawRequest) => {
      const { id } = WorkspaceIdRequestSchema.parse(rawRequest);
      return this.handleRequest<WorkspaceResponse>(
        async () => {
          const result = await workspaceUseCases.setActiveWorkspace.execute({ id });
          return result.workspace;
        },
        { channel: WORKSPACE_CHANNELS.SET_ACTIVE, workspaceId: id },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.GET_ACTIVE, async () => {
      return this.handleRequest<GetActiveWorkspaceResponse>(
        async () => {
          const result = await workspaceUseCases.getActiveWorkspace.execute();
          return { workspace: result.workspace };
        },
        { channel: WORKSPACE_CHANNELS.GET_ACTIVE },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.UPDATE, async (_event, rawRequest) => {
      const request = UpdateWorkspaceRequestSchema.parse(rawRequest);
      return this.handleRequest<WorkspaceResponse>(
        async () => {
          const result = await workspaceUseCases.updateWorkspace.execute(request);
          return result.workspace;
        },
        { channel: WORKSPACE_CHANNELS.UPDATE, workspaceId: request.id },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.SELECT_FOLDER, async (_event, rawRequest) => {
      const request = SelectFolderRequestSchema.parse(rawRequest ?? {});
      return this.handleRequest<SelectFolderResponse>(
        async () => {
          return await workspaceUseCases.selectFolder.execute(request);
        },
        { channel: WORKSPACE_CHANNELS.SELECT_FOLDER },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.VALIDATE_PATH, async (_event, rawRequest) => {
      const { path, folderPath } = ValidatePathRequestSchema.parse(rawRequest);
      const resolvedPath = folderPath ?? path!;
      return this.handleRequest<ValidatePathResponse>(
        async () => {
          const result = await workspaceUseCases.validatePath.execute({
            folderPath: resolvedPath,
          });
          return { valid: result.valid, message: result.error };
        },
        { channel: WORKSPACE_CHANNELS.VALIDATE_PATH, folderPath: resolvedPath },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.CREATE_FOLDER, async (_event, rawRequest) => {
      const request = CreateFolderRequestSchema.parse(rawRequest);
      return this.handleRequest<FolderPathResponse>(
        async () => {
          const result = await workspaceUseCases.createFolder.execute(request);
          return { folderPath: result.path };
        },
        { channel: WORKSPACE_CHANNELS.CREATE_FOLDER, parentPath: request.parentPath },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.RENAME_FOLDER, async (_event, rawRequest) => {
      const request = RenameFolderRequestSchema.parse(rawRequest);
      return this.handleRequest<FolderPathResponse>(
        async () => {
          const result = await workspaceUseCases.renameFolder.execute(request);
          return { folderPath: result.newPath };
        },
        { channel: WORKSPACE_CHANNELS.RENAME_FOLDER, path: request.path },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.DELETE_FOLDER, async (_event, rawRequest) => {
      const request = DeleteFolderRequestSchema.parse(rawRequest);
      // The existing renderer contract expects `{ success: boolean }` here —
      // preserved rather than silently upgraded to void.
      return this.handleRequest<{ success: boolean }>(
        async () => {
          await workspaceUseCases.deleteFolder.execute(request);
          return { success: true };
        },
        { channel: WORKSPACE_CHANNELS.DELETE_FOLDER, path: request.path },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.MOVE_FOLDER, async (_event, rawRequest) => {
      const request = MoveFolderRequestSchema.parse(rawRequest);
      return this.handleRequest<FolderPathResponse>(
        async () => {
          const result = await workspaceUseCases.moveFolder.execute(request);
          return { folderPath: result.newPath };
        },
        {
          channel: WORKSPACE_CHANNELS.MOVE_FOLDER,
          sourcePath: request.sourcePath,
          destinationPath: request.destinationPath,
        },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.SCAN, async (_event, rawRequest) => {
      const request = ScanWorkspaceRequestSchema.parse(rawRequest);
      return this.handleRequest<ScanWorkspaceResponse>(
        async () => {
          return await workspaceUseCases.scanWorkspace.execute(request);
        },
        { channel: WORKSPACE_CHANNELS.SCAN, workspaceId: request.workspaceId },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.SYNC, async (_event, rawRequest) => {
      const request = SyncWorkspaceRequestSchema.parse(rawRequest ?? {});
      return this.handleRequest<SyncWorkspaceResponse>(
        async () => {
          return await workspaceUseCases.syncWorkspace.execute(request);
        },
        { channel: WORKSPACE_CHANNELS.SYNC, workspaceId: request.workspaceId },
      );
    });

    logger.info('[WorkspaceIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(WORKSPACE_CHANNELS.CREATE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.GET_ALL);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.DELETE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SET_ACTIVE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.GET_ACTIVE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.UPDATE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SELECT_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.VALIDATE_PATH);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.CREATE_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.RENAME_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.DELETE_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.MOVE_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SCAN);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SYNC);
  }

  private async handleRequest<T>(
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<IPCResponse<T>> {
    return handleIpcRequest(fn, {
      loggerPrefix: 'WorkspaceIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: {
        ...COMMON_IPC_ERROR_MAP,
        WorkspaceNotFoundError: 'WORKSPACE_NOT_FOUND',
      },
      context,
    });
  }
}
