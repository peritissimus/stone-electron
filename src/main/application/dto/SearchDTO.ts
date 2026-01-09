/**
 * Search DTOs
 *
 * Data Transfer Objects for search operations.
 */

import type { NoteProps } from '../../domain/entities';

// ============================================================================
// Request DTOs
// ============================================================================

export interface SearchQueryDTO {
  query: string;
  workspaceId?: string;
  notebookId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SemanticSearchDTO {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface SimilarNotesDTO {
  noteId: string;
  limit?: number;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface SearchResultDTO {
  note: NoteProps;
  score?: number;
  highlights?: string[];
}

export interface SearchResponseDTO {
  results: SearchResultDTO[];
  total: number;
  query: string;
}

export interface SemanticSearchResultDTO {
  noteId: string;
  title: string;
  distance: number;
}

export interface SemanticSearchResponseDTO {
  results: SemanticSearchResultDTO[];
}
