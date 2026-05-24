/**
 * AI wire types — shapes used over IPC for the AI use cases.
 *
 * These mirror backend domain DTOs (CitationSource, AskNotesResponse, etc.)
 * but live here so both renderer components and the api layer can import
 * them without crossing layer boundaries.
 */

export interface CitationSource {
  chunkId: string;
  noteId: string;
  title: string;
  headingPath?: string[];
  excerpt: string;
}

export interface AskNotesRequestPayload {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface AskNotesResponse {
  answer: string;
  sources: CitationSource[];
}

export interface SummarizeNoteResponse {
  summary: string;
  sources: CitationSource[];
}

export interface SuggestedLink {
  noteId: string;
  title: string;
  reason: string;
  score: number;
}

export interface SuggestLinksResponse {
  links: SuggestedLink[];
}
