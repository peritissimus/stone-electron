/**
 * Wire shape for the "Related Notes" editor sidecar.
 */

export interface RelatedNoteMatch {
  noteId: string;
  title: string;
  /** Best chunk-to-source cosine in [-1, 1]. */
  similarity: number;
  matchedChunks: number;
  bestChunk: {
    chunkId: string;
    headingPath: string[];
    excerpt: string;
  };
}
