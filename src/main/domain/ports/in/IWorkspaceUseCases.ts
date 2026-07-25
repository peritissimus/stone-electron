/**
 * Workspace Use Cases Port (Inbound)
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type { WorkspaceProps } from '../../entities';

// =============================================================================
// Requests / Responses
// =============================================================================

export interface CreateWorkspaceRequest {
  name: string;
  folderPath: string;
  setActive?: boolean;
}

export interface CreateWorkspaceResponse {
  workspace: WorkspaceProps;
}

export interface GetWorkspaceRequest {
  id: string;
}

export interface GetWorkspaceResponse {
  workspace: WorkspaceProps;
}

export interface ListWorkspacesResponse {
  workspaces: WorkspaceProps[];
}

export interface GetActiveWorkspaceResponse {
  workspace: WorkspaceProps | null;
}

export interface SetActiveWorkspaceRequest {
  id: string;
}

export interface SetActiveWorkspaceResponse {
  workspace: WorkspaceProps;
}

export interface DeleteWorkspaceRequest {
  id: string;
}

export interface UpdateWorkspaceRequest {
  id: string;
  name?: string;
}

export interface UpdateWorkspaceResponse {
  workspace: WorkspaceProps;
}

export interface GetDefaultWorkspacePathResponse {
  /** Absolute path suggested for a new notebook workspace. */
  path: string;
}

export interface SelectFolderRequest {
  title?: string;
  defaultPath?: string;
}

export interface SelectFolderResponse {
  canceled: boolean;
  folderPath?: string;
}

export interface ValidatePathRequest {
  folderPath: string;
}

export interface ValidatePathResponse {
  valid: boolean;
  error?: string;
}

export interface CreateFolderRequest {
  name: string;
  parentPath?: string;
}

export interface CreateFolderResponse {
  path: string;
}

export interface RenameFolderRequest {
  path: string;
  name: string;
}

export interface RenameFolderResponse {
  oldPath: string;
  newPath: string;
}

export interface DeleteFolderRequest {
  path: string;
}

export interface MoveFolderRequest {
  sourcePath: string;
  destinationPath: string | null;
}

export interface MoveFolderResponse {
  oldPath: string;
  newPath: string;
}

export interface ScanWorkspaceRequest {
  workspaceId: string;
}

export interface ScanWorkspaceFileEntry {
  relativePath: string;
  path: string;
}

export interface ScanWorkspaceFolderStructure {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'folder';
  children?: ScanWorkspaceFolderStructure[];
}

export interface ScanWorkspaceResponse {
  files: ScanWorkspaceFileEntry[];
  structure: ScanWorkspaceFolderStructure[];
  total: number;
  counts: Record<string, number>;
}

export interface SyncWorkspaceRequest {
  workspaceId?: string;
}

export interface SyncWorkspaceResponse {
  workspaceId: string;
  notebooks: {
    created: number;
    updated: number;
    errors: string[];
  };
  notes: {
    created: number;
    updated: number;
    deleted: number;
    /**
     * Number of newly imported notes that were also embedded inline during
     * this sync (so they're immediately searchable without a follow-up
     * reclassify). Always <= created. Zero if the embedding worker isn't
     * ready yet at sync time.
     */
    embedded: number;
    errors: string[];
  };
}

// =============================================================================
// Use Case Interfaces
// =============================================================================

export interface ICreateWorkspaceUseCase {
  execute(request: CreateWorkspaceRequest): Effect.Effect<CreateWorkspaceResponse, Error>;
}

export interface IGetWorkspaceUseCase {
  execute(request: GetWorkspaceRequest): Effect.Effect<GetWorkspaceResponse, Error>;
}

export interface IListWorkspacesUseCase {
  execute(): Effect.Effect<ListWorkspacesResponse, Error>;
}

export interface IGetActiveWorkspaceUseCase {
  execute(): Effect.Effect<GetActiveWorkspaceResponse, Error>;
}

export interface ISetActiveWorkspaceUseCase {
  execute(request: SetActiveWorkspaceRequest): Effect.Effect<SetActiveWorkspaceResponse, Error>;
}

export interface IDeleteWorkspaceUseCase {
  execute(request: DeleteWorkspaceRequest): Effect.Effect<void, Error>;
}

export interface IUpdateWorkspaceUseCase {
  execute(request: UpdateWorkspaceRequest): Effect.Effect<UpdateWorkspaceResponse, Error>;
}

export interface IGetDefaultWorkspacePathUseCase {
  execute(): Effect.Effect<GetDefaultWorkspacePathResponse, Error>;
}

export interface ISelectFolderUseCase {
  execute(request?: SelectFolderRequest): Effect.Effect<SelectFolderResponse, Error>;
}

export interface IValidatePathUseCase {
  execute(request: ValidatePathRequest): Effect.Effect<ValidatePathResponse, Error>;
}

export interface ICreateFolderUseCase {
  execute(request: CreateFolderRequest): Effect.Effect<CreateFolderResponse, Error>;
}

export interface IRenameFolderUseCase {
  execute(request: RenameFolderRequest): Effect.Effect<RenameFolderResponse, Error>;
}

export interface IDeleteFolderUseCase {
  execute(request: DeleteFolderRequest): Effect.Effect<void, Error>;
}

export interface IMoveFolderUseCase {
  execute(request: MoveFolderRequest): Effect.Effect<MoveFolderResponse, Error>;
}

export interface IScanWorkspaceUseCase {
  execute(request: ScanWorkspaceRequest): Effect.Effect<ScanWorkspaceResponse, Error>;
}

export interface ISyncWorkspaceUseCase {
  execute(request?: SyncWorkspaceRequest): Effect.Effect<SyncWorkspaceResponse, Error>;
}

/**
 * Aggregated Workspace Use Cases (for DI container)
 */
export interface IWorkspaceUseCases {
  createWorkspace: ICreateWorkspaceUseCase;
  getWorkspace: IGetWorkspaceUseCase;
  listWorkspaces: IListWorkspacesUseCase;
  setActiveWorkspace: ISetActiveWorkspaceUseCase;
  getActiveWorkspace: IGetActiveWorkspaceUseCase;
  deleteWorkspace: IDeleteWorkspaceUseCase;
  updateWorkspace: IUpdateWorkspaceUseCase;
  getDefaultWorkspacePath: IGetDefaultWorkspacePathUseCase;
  selectFolder: ISelectFolderUseCase;
  validatePath: IValidatePathUseCase;
  createFolder: ICreateFolderUseCase;
  renameFolder: IRenameFolderUseCase;
  deleteFolder: IDeleteFolderUseCase;
  moveFolder: IMoveFolderUseCase;
  scanWorkspace: IScanWorkspaceUseCase;
  syncWorkspace: ISyncWorkspaceUseCase;
}

export const WorkspaceUseCasesPort =
  Context.GenericTag<IWorkspaceUseCases>('stone/IWorkspaceUseCases');
