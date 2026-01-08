/**
 * Tag DTOs
 *
 * Data Transfer Objects for tag operations.
 */

import type { TagProps } from '../../domain/entities';

// ============================================================================
// Request DTOs
// ============================================================================

export interface CreateTagDTO {
  name: string;
  color?: string;
}

export interface UpdateTagDTO {
  id: string;
  name?: string;
  color?: string;
}

export interface GetTagDTO {
  id: string;
}

export interface DeleteTagDTO {
  id: string;
}

export interface AddTagToNoteDTO {
  noteId: string;
  tagId: string;
}

export interface RemoveTagFromNoteDTO {
  noteId: string;
  tagId: string;
}

export interface GetNoteTagsDTO {
  noteId: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface TagResponseDTO {
  tag: TagProps;
}

export interface TagListResponseDTO {
  tags: TagProps[];
}

export interface TagWithCountDTO extends TagProps {
  noteCount: number;
}
