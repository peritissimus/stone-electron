/**
 * GetRelatedNotesUseCase — drives the "Related Notes" panel in the editor.
 *
 * Strategy:
 *   1. Get the active note's mean chunk vector (canonical "note vector").
 *   2. Use the chunk vector index to fetch a wide pool of similar chunks
 *      across the workspace.
 *   3. Drop chunks from the source note itself, then group by noteId and
 *      keep the strongest chunk per note (max-pooled — same scoring as
 *      AskNotes uses for its citations).
 *   4. Hydrate with note titles and return the top N matches with the
 *      best chunk's heading path + excerpt so the UI can show *why* this
 *      note is related, not just that it is.
 *
 * The "wide pool" size is chosen to give us enough chunk diversity to find
 * at least N distinct notes; for noisy workspaces we may end up with fewer.
 */

import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type { IReranker } from '../../../domain/ports/out/IReranker';
import type {
  IGetRelatedNotesUseCase,
  GetRelatedNotesRequest,
  GetRelatedNotesResponse,
  RelatedNoteMatch,
} from '../../../domain/ports/in/ISearchUseCases';

const DEFAULT_LIMIT = 5;
const POOL_MULTIPLIER = 12; // pull ~5×12 = 60 candidate chunks
const RERANK_POOL = 30;
const SNIPPET_CHARS = 240;

export class GetRelatedNotesUseCase implements IGetRelatedNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly indexRepository: IIndexRepository,
    private readonly reranker?: IReranker,
  ) {}

  async execute(request: GetRelatedNotesRequest): Promise<GetRelatedNotesResponse> {
    const limit = request.limit ?? DEFAULT_LIMIT;
    if (limit <= 0) return { results: [] };

    const note = await this.noteRepository.findById(request.noteId);
    if (!note) return { results: [] };

    const workspaceId = request.workspaceId ?? note.workspaceId ?? undefined;

    const sourceVec = await this.indexRepository.getNoteVector(request.noteId);
    if (!sourceVec) return { results: [] };

    const poolSize = Math.max(POOL_MULTIPLIER * limit, 30);
    const candidatesAll = await this.indexRepository.searchVector(sourceVec, {
      limit: poolSize,
      workspaceId,
    });
    const candidates = candidatesAll.filter((c) => c.chunk.noteId !== request.noteId);

    // Cross-encoder rerank uses the source note's title as the "query" —
    // titles are concise and high-signal, and fit comfortably in the
    // cross-encoder's joint context window.
    const scoreById = await this.rerankScores(note.title, candidates);

    // Group by noteId, keep the best chunk per note. Use the rerank score
    // when available, fall back to the embedding similarity otherwise.
    interface Bucket {
      noteId: string;
      bestChunk: (typeof candidates)[number]['chunk'];
      bestScore: number;
      matchedChunks: number;
    }
    const buckets = new Map<string, Bucket>();
    for (const c of candidates) {
      const score = scoreById?.get(c.chunk.id) ?? c.semanticScore ?? c.combinedScore;
      const existing = buckets.get(c.chunk.noteId);
      if (!existing) {
        buckets.set(c.chunk.noteId, {
          noteId: c.chunk.noteId,
          bestChunk: c.chunk,
          bestScore: score,
          matchedChunks: 1,
        });
      } else {
        existing.matchedChunks += 1;
        if (score > existing.bestScore) {
          existing.bestScore = score;
          existing.bestChunk = c.chunk;
        }
      }
    }

    const ranked = [...buckets.values()]
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, limit);

    const results: RelatedNoteMatch[] = [];
    for (const bucket of ranked) {
      const noteRow = await this.noteRepository.findById(bucket.noteId);
      results.push({
        noteId: bucket.noteId,
        title: noteRow?.title || 'Untitled',
        similarity: bucket.bestScore,
        matchedChunks: bucket.matchedChunks,
        bestChunk: {
          chunkId: bucket.bestChunk.id,
          headingPath: bucket.bestChunk.headingPath,
          excerpt: trimForSnippet(bucket.bestChunk.text),
        },
      });
    }

    return { results };
  }

  private async rerankScores(
    query: string,
    candidates: Array<{ chunk: { id: string; text: string } }>,
  ): Promise<Map<string, number> | null> {
    if (!this.reranker || candidates.length === 0 || !query.trim()) return null;
    const pool = candidates.slice(0, RERANK_POOL);
    try {
      const scored = await this.reranker.rerank({
        query,
        documents: pool.map((c) => ({ id: c.chunk.id, text: c.chunk.text })),
      });
      // Sigmoid keeps reranker scores in [0, 1] so they're comparable when
      // mixed with the cosine-similarity fallback for chunks outside the pool.
      const map = new Map<string, number>();
      for (const s of scored) map.set(s.id, sigmoid(s.score));
      return map;
    } catch {
      return null;
    }
  }
}

function trimForSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= SNIPPET_CHARS) return normalized;
  return `${normalized.slice(0, SNIPPET_CHARS).trim()}…`;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
