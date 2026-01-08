/**
 * Notebook DTOs
 *
 * Data Transfer Objects for notebook operations.
 */

import type { NotebookProps } from '../../domain/entities';

// ============================================================================
// Request DTOs
// ============================================================================

export interface CreateNotebookDTO {
  name: string;
  parentId?: string;
  workspaceId?: string;
  folderPath?: string;
  icon?: string;
  color?: string;
}

export interface UpdateNotebookDTO {
  id: string;
  name?: string;
  parentId?: string;
  icon?: string;
  color?: string;
}

export interface GetNotebookDTO {
  id: string;
}

export interface ListNotebooksDTO {
  workspaceId?: string;
  parentId?: string | null;
}

export interface DeleteNotebookDTO {
  id: string;
}

export interface MoveNotebookDTO {
  id: string;
  targetParentId: string | null;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface NotebookResponseDTO {
  notebook: NotebookProps;
}

export interface NotebookListResponseDTO {
  notebooks: NotebookProps[];
}

export interface NotebookTreeNode extends NotebookProps {
  children: NotebookTreeNode[];
  noteCount?: number;
}

export interface NotebookTreeResponseDTO {
  tree: NotebookTreeNode[];
}
