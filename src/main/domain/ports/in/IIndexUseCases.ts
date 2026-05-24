/**
 * Index Use Cases — chunk + embed the markdown body of one or more notes so
 * they become searchable. Replaces the previous note-level embedding flow.
 */

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
  execute(request: IndexNoteRequest): Promise<IndexNoteResponse>;
}

export interface IRebuildAllNotesIndexUseCase {
  execute(request?: RebuildAllNotesIndexRequest): Promise<RebuildAllNotesIndexResponse>;
}

export interface IIndexUseCases {
  indexNote: IIndexNoteUseCase;
  rebuildAll: IRebuildAllNotesIndexUseCase;
}
