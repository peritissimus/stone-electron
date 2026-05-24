import type { CitationSource } from '../out/ITextGenerator';

export interface AskNotesRequest {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface AskNotesResponse {
  answer: string;
  sources: CitationSource[];
}

export interface SummarizeNoteRequest {
  noteId: string;
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

export interface SuggestLinksRequest {
  noteId: string;
  limit?: number;
}

export interface SuggestLinksResponse {
  links: SuggestedLink[];
}

export interface IAskNotesUseCase {
  execute(request: AskNotesRequest): Promise<AskNotesResponse>;
}

export interface ISummarizeNoteUseCase {
  execute(request: SummarizeNoteRequest): Promise<SummarizeNoteResponse>;
}

export interface ISuggestLinksUseCase {
  execute(request: SuggestLinksRequest): Promise<SuggestLinksResponse>;
}

export interface IAIUseCases {
  askNotes: IAskNotesUseCase;
  summarizeNote: ISummarizeNoteUseCase;
  suggestLinks: ISuggestLinksUseCase;
}
