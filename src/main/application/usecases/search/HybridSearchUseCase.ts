/**
 * HybridSearchUseCase — chunk-level retrieval merged with Reciprocal Rank
 * Fusion, then aggregated to note-level rows for the legacy callers.
 *
 * Pipeline:
 *   1. Ask the chunk-FTS for top-N matches.
 *   2. Embed the query, ask the chunk vector store for top-N matches.
 *   3. RRF-merge the two ranked lists (k=60).
 *   4. Group the merged chunks by noteId, keep the best chunk per note for
 *      the snippet, and sum the per-chunk RRF scores into a note score
 *      (capped at the top-3 chunks per note so a long note doesn't dominate
 *      purely on volume).
 *   5. Load each note's metadata and return a `HybridSearchResultRow` per
 *      note with its top contributing chunks attached.
 */

import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type {
  IIndexRepository,
  ChunkSearchResult,
} from '../../../domain/ports/out/IIndexRepository';
import type { IReranker } from '../../../domain/ports/out/IReranker';
import type {
  IHybridSearchUseCase,
  HybridSearchRequest,
  HybridSearchResponse,
  HybridSearchChunkHit,
  HybridSearchResultRow,
} from '../../../domain/ports/in/ISearchUseCases';

const RRF_K = 60;
const CHUNK_CANDIDATES = 40;
const NOTE_TOP_CHUNKS = 3;
const SNIPPET_CHARS = 240;
// Cross-encoder is slow per pair — bound the rescoring work to the top of
// the RRF list. 30 chunks is well under a second on the local MiniLM model.
const RERANK_POOL = 30;

interface MergedChunk {
  chunkId: string;
  noteId: string;
  headingPath: string[];
  text: string;
  ftsRank?: number;
  semanticRank?: number;
  rrfScore: number;
}

export class HybridSearchUseCase implements IHybridSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embedder: IEmbedder,
    private readonly indexRepository: IIndexRepository,
    private readonly reranker?: IReranker,
  ) {}

  async execute(request: HybridSearchRequest): Promise<HybridSearchResponse> {
    const startTime = Date.now();
    const limit = request.limit && request.limit > 0 ? request.limit : 20;

    const query = request.query.trim();
    if (!query) {
      return { results: [], total: 0, queryTimeMs: Date.now() - startTime };
    }

    const candidateLimit = Math.max(CHUNK_CANDIDATES, limit * 4);

    const [ftsHits, semanticHits] = await Promise.all([
      this.indexRepository.searchFullText(query, {
        limit: candidateLimit,
        workspaceId: request.workspaceId,
      }),
      this.runSemantic(query, candidateLimit, request.workspaceId),
    ]);

    const merged = mergeWithRrf(ftsHits, semanticHits);
    if (merged.length === 0) {
      return { results: [], total: 0, queryTimeMs: Date.now() - startTime };
    }

    // Cross-encoder rerank of the RRF top-N. Replaces the RRF score for the
    // pool with a normalized cross-encoder score; chunks below the pool keep
    // their RRF score (still useful as a fallback if the pool dries up).
    await this.applyRerank(query, merged);

    const noteScores = aggregateByNote(merged);

    // Sort notes by aggregated score and clip
    const ranked = [...noteScores.entries()]
      .map(([noteId, bucket]) => ({ noteId, ...bucket }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit);

    // Load note metadata in bulk
    const noteRows = await Promise.all(
      ranked.map(async (row): Promise<HybridSearchResultRow | null> => {
        const note = await this.noteRepository.findById(row.noteId);
        if (!note) return null;

        const chunks: HybridSearchChunkHit[] = row.chunks.map((c) => ({
          chunkId: c.chunkId,
          noteId: c.noteId,
          headingPath: c.headingPath,
          excerpt: trimForSnippet(c.text),
          score: c.rrfScore,
          sources: chunkSources(c),
        }));

        const searchType: HybridSearchResultRow['searchType'] =
          row.fromFts && row.fromSemantic ? 'hybrid' : row.fromFts ? 'fts' : 'semantic';

        return {
          note,
          score: row.totalScore,
          searchType,
          chunks,
        };
      }),
    );

    const results: HybridSearchResultRow[] = noteRows.filter(
      (r): r is HybridSearchResultRow => r !== null,
    );

    return {
      results,
      total: results.length,
      queryTimeMs: Date.now() - startTime,
    };
  }

  private async runSemantic(
    query: string,
    limit: number,
    workspaceId?: string,
  ): Promise<ChunkSearchResult[]> {
    if (!this.embedder.isReady()) return [];
    try {
      const queryVec = await this.embedder.generateEmbedding(query);
      return await this.indexRepository.searchVector(Array.from(queryVec), {
        limit,
        workspaceId,
      });
    } catch {
      return [];
    }
  }

  private async applyRerank(query: string, merged: MergedChunk[]): Promise<void> {
    if (!this.reranker) return;
    const pool = merged.slice(0, RERANK_POOL);
    if (pool.length === 0) return;

    try {
      const scored = await this.reranker.rerank({
        query,
        documents: pool.map((c) => ({ id: c.chunkId, text: c.text })),
      });
      const byId = new Map(scored.map((s) => [s.id, s.score]));
      for (const chunk of pool) {
        const s = byId.get(chunk.chunkId);
        if (s === undefined) continue;
        // Sigmoid maps logits to [0, 1] so reranked chunks dominate the tail.
        chunk.rrfScore = sigmoid(s);
      }
      merged.sort((a, b) => b.rrfScore - a.rrfScore);
    } catch {
      // Reranker failure shouldn't break search — fall through with RRF order.
    }
  }
}

/* ---------- helpers ---------- */

function mergeWithRrf(
  ftsHits: ChunkSearchResult[],
  semanticHits: ChunkSearchResult[],
): MergedChunk[] {
  const byId = new Map<string, MergedChunk>();

  for (let i = 0; i < ftsHits.length; i += 1) {
    const c = ftsHits[i].chunk;
    const merged: MergedChunk = byId.get(c.id) ?? {
      chunkId: c.id,
      noteId: c.noteId,
      headingPath: c.headingPath,
      text: c.text,
      rrfScore: 0,
    };
    merged.ftsRank = i;
    merged.rrfScore += 1 / (RRF_K + i + 1);
    byId.set(c.id, merged);
  }

  for (let i = 0; i < semanticHits.length; i += 1) {
    const c = semanticHits[i].chunk;
    const merged: MergedChunk = byId.get(c.id) ?? {
      chunkId: c.id,
      noteId: c.noteId,
      headingPath: c.headingPath,
      text: c.text,
      rrfScore: 0,
    };
    merged.semanticRank = i;
    merged.rrfScore += 1 / (RRF_K + i + 1);
    byId.set(c.id, merged);
  }

  return [...byId.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}

interface NoteBucket {
  totalScore: number;
  chunks: MergedChunk[];
  fromFts: boolean;
  fromSemantic: boolean;
}

function aggregateByNote(chunks: MergedChunk[]): Map<string, NoteBucket> {
  const buckets = new Map<string, NoteBucket>();

  for (const chunk of chunks) {
    const existing = buckets.get(chunk.noteId) ?? {
      totalScore: 0,
      chunks: [],
      fromFts: false,
      fromSemantic: false,
    };
    existing.chunks.push(chunk);
    if (chunk.ftsRank !== undefined) existing.fromFts = true;
    if (chunk.semanticRank !== undefined) existing.fromSemantic = true;
    buckets.set(chunk.noteId, existing);
  }

  // Sort each bucket's chunks best-first, cap and sum
  for (const bucket of buckets.values()) {
    bucket.chunks.sort((a, b) => b.rrfScore - a.rrfScore);
    const top = bucket.chunks.slice(0, NOTE_TOP_CHUNKS);
    bucket.totalScore = top.reduce((acc, c) => acc + c.rrfScore, 0);
    bucket.chunks = top;
  }

  return buckets;
}

function chunkSources(c: MergedChunk): Array<'fts' | 'semantic'> {
  const out: Array<'fts' | 'semantic'> = [];
  if (c.ftsRank !== undefined) out.push('fts');
  if (c.semanticRank !== undefined) out.push('semantic');
  return out;
}

function trimForSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= SNIPPET_CHARS) return normalized;
  return `${normalized.slice(0, SNIPPET_CHARS).trim()}…`;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
