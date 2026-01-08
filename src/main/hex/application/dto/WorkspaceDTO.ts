/**
 * Workspace DTOs
 *
 * Data Transfer Objects for workspace operations.
 */

import type { WorkspaceProps } from '../../domain/entities';

// ============================================================================
// Request DTOs
// ============================================================================

export interface CreateWorkspaceDTO {
  name: string;
  folderPath: string;
}

export interface UpdateWorkspaceDTO {
  id: string;
  name?: string;
}

export interface GetWorkspaceDTO {
  id: string;
}

export interface SetActiveWorkspaceDTO {
  id: string;
}

export interface SyncWorkspaceDTO {
  id: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface WorkspaceResponseDTO {
  workspace: WorkspaceProps;
}

export interface WorkspaceListResponseDTO {
  workspaces: WorkspaceProps[];
}

export interface WorkspaceSyncResultDTO {
  created: number;
  updated: number;
  deleted: number;
}
