import { Context } from 'effect';
import type { Effect } from 'effect';
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
  execute(request: AskNotesRequest): Effect.Effect<AskNotesResponse, Error>;
}

export interface ISummarizeNoteUseCase {
  execute(
    request: SummarizeNoteRequest,
  ): Effect.Effect<SummarizeNoteResponse, Error>;
}

export interface ISuggestLinksUseCase {
  execute(
    request: SuggestLinksRequest,
  ): Effect.Effect<SuggestLinksResponse, Error>;
}

export interface IAIUseCases {
  askNotes: IAskNotesUseCase;
  summarizeNote: ISummarizeNoteUseCase;
  suggestLinks: ISuggestLinksUseCase;
}

export const AIUseCasesPort =
  Context.GenericTag<IAIUseCases>('stone/IAIUseCases');
