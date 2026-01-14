/**
 * Workspace Use Cases Port (Inbound)
 */

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
    errors: string[];
  };
}

// =============================================================================
// Use Case Interfaces
// =============================================================================

export interface ICreateWorkspaceUseCase {
  execute(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse>;
}

export interface IGetWorkspaceUseCase {
  execute(request: GetWorkspaceRequest): Promise<GetWorkspaceResponse>;
}

export interface IListWorkspacesUseCase {
  execute(): Promise<ListWorkspacesResponse>;
}

export interface IGetActiveWorkspaceUseCase {
  execute(): Promise<GetActiveWorkspaceResponse>;
}

export interface ISetActiveWorkspaceUseCase {
  execute(request: SetActiveWorkspaceRequest): Promise<SetActiveWorkspaceResponse>;
}

export interface IDeleteWorkspaceUseCase {
  execute(request: DeleteWorkspaceRequest): Promise<void>;
}

export interface IUpdateWorkspaceUseCase {
  execute(request: UpdateWorkspaceRequest): Promise<UpdateWorkspaceResponse>;
}

export interface ISelectFolderUseCase {
  execute(request?: SelectFolderRequest): Promise<SelectFolderResponse>;
}

export interface IValidatePathUseCase {
  execute(request: ValidatePathRequest): Promise<ValidatePathResponse>;
}

export interface ICreateFolderUseCase {
  execute(request: CreateFolderRequest): Promise<CreateFolderResponse>;
}

export interface IRenameFolderUseCase {
  execute(request: RenameFolderRequest): Promise<RenameFolderResponse>;
}

export interface IDeleteFolderUseCase {
  execute(request: DeleteFolderRequest): Promise<void>;
}

export interface IMoveFolderUseCase {
  execute(request: MoveFolderRequest): Promise<MoveFolderResponse>;
}

export interface IScanWorkspaceUseCase {
  execute(request: ScanWorkspaceRequest): Promise<ScanWorkspaceResponse>;
}

export interface ISyncWorkspaceUseCase {
  execute(request?: SyncWorkspaceRequest): Promise<SyncWorkspaceResponse>;
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
  selectFolder: ISelectFolderUseCase;
  validatePath: IValidatePathUseCase;
  createFolder: ICreateFolderUseCase;
  renameFolder: IRenameFolderUseCase;
  deleteFolder: IDeleteFolderUseCase;
  moveFolder: IMoveFolderUseCase;
  scanWorkspace: IScanWorkspaceUseCase;
  syncWorkspace: ISyncWorkspaceUseCase;
}
