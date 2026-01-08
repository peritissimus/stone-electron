/**
 * Workspace Use Cases Port (Inbound)
 */

import type { WorkspaceProps } from '../../entities';

export interface CreateWorkspaceRequest {
  name: string;
  folderPath: string;
  setActive?: boolean;
}

export interface CreateWorkspaceResponse {
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

export interface DeleteWorkspaceRequest {
  id: string;
}

export interface SyncWorkspaceRequest {
  id: string;
}

// Use Case Interfaces
export interface ICreateWorkspaceUseCase {
  execute(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse>;
}

export interface IListWorkspacesUseCase {
  execute(): Promise<ListWorkspacesResponse>;
}

export interface IGetActiveWorkspaceUseCase {
  execute(): Promise<GetActiveWorkspaceResponse>;
}

export interface ISetActiveWorkspaceUseCase {
  execute(request: SetActiveWorkspaceRequest): Promise<void>;
}

export interface IDeleteWorkspaceUseCase {
  execute(request: DeleteWorkspaceRequest): Promise<void>;
}

export interface ISyncWorkspaceUseCase {
  execute(request: SyncWorkspaceRequest): Promise<void>;
}
