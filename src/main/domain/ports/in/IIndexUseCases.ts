/**
 * Index Use Cases — chunk + embed the markdown body of one or more notes so
 * they become searchable. Replaces the previous note-level embedding flow.
 */
import { Context } from 'effect';
import type { Effect } from 'effect';

export interface IndexNoteRequest {
  noteId: string;
  /** Re-index even if the note's content hash matches the existing status. */
  force?: boolean;
}

export interface IndexNoteResponse {
  noteId: string;
  status: 'indexed' | 'skipped' | 'failed' | 'missing';
  chunkCount: number;
  error?: string;
}

export interface RebuildAllNotesIndexRequest {
  workspaceId?: string;
  force?: boolean;
}

export interface RebuildAllNotesIndexResponse {
  workspaceId: string;
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  missing: number;
}

export interface IIndexNoteUseCase {
  execute(request: IndexNoteRequest): Effect.Effect<IndexNoteResponse, Error>;
}

export interface IRebuildAllNotesIndexUseCase {
  execute(
    request?: RebuildAllNotesIndexRequest,
  ): Effect.Effect<RebuildAllNotesIndexResponse, Error>;
}

export interface IndexStatsRequest {
  /** Defaults to the active workspace. */
  workspaceId?: string;
}

export interface IndexStatsResponse {
  workspaceId: string;
  totalNotes: number;
  indexedNotes: number;
  pendingNotes: number;
  failedNotes: number;
  chunkCount: number;
}

export interface IGetIndexStatsUseCase {
  execute(request?: IndexStatsRequest): Effect.Effect<IndexStatsResponse, Error>;
}

export interface IIndexUseCases {
  indexNote: IIndexNoteUseCase;
  rebuildAll: IRebuildAllNotesIndexUseCase;
  getStats: IGetIndexStatsUseCase;
}

export const IndexUseCasesPort =
  Context.GenericTag<IIndexUseCases>('stone/IIndexUseCases');
