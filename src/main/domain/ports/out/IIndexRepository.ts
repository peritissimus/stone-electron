/**
 * IIndexRepository — chunk-level retrieval persistence.
 *
 * Owns the note_chunks + note_index_records + note_chunks_fts tables. Keeping
 * this separate from INoteRepository so the chunk lifecycle (re-chunk on
 * change, embed in batches, FTS sync) doesn't bloat the note interface.
 *
 * The "embedding" field on each chunk is a Float32Array packed as a Buffer in
 * the same convention as notes.embedding. The adapter handles encoding.
 */

export interface NoteChunkRecord {
  id: string;
  noteId: string;
  workspaceId: string;
  chunkIndex: number;
  /** Hierarchical heading context, e.g. ["Auth", "Sessions", "Refresh"]. */
  headingPath: string[];
  text: string;
  /** Stable hash of `text` — lets the indexer skip unchanged chunks. */
  contentHash: string;
  tokenCount: number;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexedNoteStatus {
  noteId: string;
  workspaceId: string;
  contentHash: string;
  chunkCount: number;
  indexedAt: Date | null;
  model: string | null;
  dimensions: number | null;
  status: 'pending' | 'indexed' | 'failed';
  error: string | null;
}

export interface WorkspaceIndexStats {
  totalNotes: number;
  indexedNotes: number;
  pendingNotes: number;
  failedNotes: number;
  chunkCount: number;
}

export interface SearchIndexOptions {
  limit: number;
  workspaceId?: string;
  /** Restrict search to a specific subset of note IDs. */
  noteIds?: string[];
}

export interface ChunkSearchResult {
  chunk: NoteChunkRecord;
  /** FTS5 rank score, lower is better; null if this result came from vector only. */
  ftsScore?: number;
  /** Cosine similarity in [-1, 1], higher is better; null if FTS-only. */
  semanticScore?: number;
  /** Adapter-merged 0..1 score for sorting; raw values are surfaced for debugging. */
  combinedScore: number;
}

export interface SimilarNoteResult {
  noteId: string;
  title: string;
  /** Best chunk cosine for this note in [-1, 1]. */
  similarity: number;
  /** Number of this note's chunks that contributed to the score. */
  matchedChunks: number;
}

export interface IIndexRepository {
  /** Read the index bookkeeping row for a note, if any. */
  getStatus(noteId: string): Promise<IndexedNoteStatus | null>;

  /** Insert or replace the index status row for a note. */
  upsertStatus(status: IndexedNoteStatus): Promise<void>;

  /** Workspace-wide health snapshot for the Knowledge page. */
  getWorkspaceStats(workspaceId: string): Promise<WorkspaceIndexStats>;

  /**
   * Atomically replace all chunks for a note. Deletes existing chunks,
   * inserts the new set, and syncs the FTS5 index. Pass an empty array to
   * remove all chunks (without removing the note itself).
   */
  replaceChunks(
    noteId: string,
    workspaceId: string,
    title: string,
    chunks: NoteChunkRecord[],
  ): Promise<void>;

  /** Remove every chunk + status row for a note (cascade is handled by FK). */
  deleteByNoteId(noteId: string): Promise<void>;

  /** FTS5 full-text search over chunks. Returns ranked results. */
  searchFullText(query: string, options: SearchIndexOptions): Promise<ChunkSearchResult[]>;

  /** Cosine similarity search over chunk embeddings. */
  searchVector(embedding: number[], options: SearchIndexOptions): Promise<ChunkSearchResult[]>;

  /**
   * Mean of a note's chunk embeddings — the canonical "note vector" for
   * topic classification and note-to-note similarity. Returns null if the
   * note has no chunks yet, or no chunks with embeddings.
   */
  getNoteVector(noteId: string): Promise<number[] | null>;

  /**
   * Rank notes by similarity of any of their chunks to the query vector.
   * Each result reports the best chunk cosine for that note (max-pooled),
   * not a note-level mean — this matches how AskNotes scores notes.
   */
  findSimilarNotesByVector(
    embedding: number[],
    options: SearchIndexOptions & { excludeNoteId?: string },
  ): Promise<SimilarNoteResult[]>;

  /**
   * Every chunk in a workspace that has an embedding. Used by the topic
   * suggester to cluster over the full corpus.
   */
  getChunksForWorkspace(workspaceId: string): Promise<NoteChunkRecord[]>;
}
