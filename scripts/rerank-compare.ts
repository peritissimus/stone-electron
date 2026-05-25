/**
 * rerank-compare.ts
 *
 * Verifies the cross-encoder reranker lift on the live db. For each query
 * we run the same recipe as HybridSearchUseCase (chunk-FTS + chunk-vector
 * fused with RRF), then layer the cross-encoder on top and print the rank
 * changes side-by-side.
 *
 *   pnpm exec tsx scripts/rerank-compare.ts \
 *     "frontdesk" "auth sessions" "infrastructure security"
 *
 * Default queries run if none are supplied.
 */
import { createClient, type Client } from '@libsql/client';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const EMBED_MODEL = 'Xenova/bge-small-en-v1.5';
const RERANK_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2';
const EMBEDDING_DIMS = 384;
const CHUNK_CANDIDATES = 40;
const RRF_K = 60;
const RERANK_POOL = 30;
const TOP_K = 5;
const NOTE_TOP_CHUNKS = 3;

const DEFAULT_QUERIES = ['frontdesk', 'auth sessions', 'infrastructure security'];

function resolveDbPath(): string {
  if (process.env.STONE_DB) return process.env.STONE_DB;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/stone/stone-data/notes.db');
  }
  if (process.platform === 'linux') {
    return path.join(os.homedir(), '.config/stone/stone-data/notes.db');
  }
  throw new Error(`No default db path for ${process.platform}. Set STONE_DB=/path/to/notes.db`);
}

function resolveCacheDir(): string {
  if (process.env.STONE_ML_CACHE) return process.env.STONE_ML_CACHE;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/stone/ml-cache');
  }
  if (process.platform === 'linux') {
    return path.join(os.homedir(), '.config/stone/ml-cache');
  }
  return path.join(os.tmpdir(), 'stone-ml-cache');
}

function decodeEmbedding(raw: unknown): Float32Array | null {
  if (raw instanceof ArrayBuffer) return new Float32Array(raw);
  if (raw instanceof Uint8Array) {
    return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  }
  return null;
}

function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// FTS5 tokens: split on whitespace, drop punctuation, quote each token so
// special chars don't trip the query parser. Matches IndexRepository.
function toFtsQuery(raw: string): string {
  return raw
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => `"${tok}"`)
    .join(' ');
}

interface Chunk {
  id: string;
  noteId: string;
  noteTitle: string;
  headingPath: string[];
  text: string;
}

interface ScoredChunk extends Chunk {
  ftsRank?: number;
  semanticRank?: number;
  rrfScore: number;
  rerankScore?: number;
}

async function loadEmbedder() {
  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  env.cacheDir = resolveCacheDir();
  const extractor = await pipeline('feature-extraction', EMBED_MODEL, { quantized: true });
  return async (text: string): Promise<Float32Array> => {
    const out = (await extractor(text, { pooling: 'mean', normalize: true })) as {
      data: Float32Array;
    };
    return out.data;
  };
}

async function loadReranker() {
  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  env.cacheDir = resolveCacheDir();
  const scorer = await pipeline('text-classification', RERANK_MODEL, { quantized: true });
  return async (query: string, texts: string[]): Promise<number[]> => {
    if (texts.length === 0) return [];
    // Cross-encoder mode: pass query alongside each document via text_pair
    // so the model attends to both jointly and outputs a single relevance
    // logit per pair.
    const out = (await scorer(
      texts.map(() => query),
      { text_pair: texts, top_k: 1 } as Record<string, unknown>,
    )) as Array<Array<{ label: string; score: number }>>;
    return out.map((rs) => rs[0]?.score ?? 0);
  };
}

async function runFts(
  client: Client,
  query: string,
  byChunkId: Map<string, Chunk>,
): Promise<Array<{ chunk: Chunk; rank: number }>> {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];
  const rs = await client.execute({
    sql: `SELECT chunk_id, rank FROM note_chunks_fts WHERE note_chunks_fts MATCH ? ORDER BY rank LIMIT ?`,
    args: [ftsQuery, CHUNK_CANDIDATES],
  });
  const out: Array<{ chunk: Chunk; rank: number }> = [];
  for (let i = 0; i < rs.rows.length; i += 1) {
    const row = rs.rows[i] as Record<string, unknown>;
    const chunk = byChunkId.get(String(row.chunk_id));
    if (!chunk) continue;
    out.push({ chunk, rank: i });
  }
  return out;
}

function runVector(
  queryVec: Float32Array,
  chunks: Chunk[],
  embeddings: Map<string, Float32Array>,
): Array<{ chunk: Chunk; rank: number }> {
  const scored: Array<{ chunk: Chunk; similarity: number }> = [];
  for (const c of chunks) {
    const vec = embeddings.get(c.id);
    if (!vec) continue;
    scored.push({ chunk: c, similarity: cosineSimilarity(queryVec, vec) });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored
    .slice(0, CHUNK_CANDIDATES)
    .map(({ chunk }, i) => ({ chunk, rank: i }));
}

function rrfMerge(
  fts: Array<{ chunk: Chunk; rank: number }>,
  vec: Array<{ chunk: Chunk; rank: number }>,
): ScoredChunk[] {
  const byId = new Map<string, ScoredChunk>();
  for (const { chunk, rank } of fts) {
    const cur = byId.get(chunk.id) ?? { ...chunk, rrfScore: 0 };
    cur.ftsRank = rank;
    cur.rrfScore += 1 / (RRF_K + rank + 1);
    byId.set(chunk.id, cur);
  }
  for (const { chunk, rank } of vec) {
    const cur = byId.get(chunk.id) ?? { ...chunk, rrfScore: 0 };
    cur.semanticRank = rank;
    cur.rrfScore += 1 / (RRF_K + rank + 1);
    byId.set(chunk.id, cur);
  }
  return [...byId.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}

interface NoteRow {
  noteId: string;
  title: string;
  totalScore: number;
  bestChunkText: string;
  bestHeadingPath: string[];
  contributingChunks: number;
}

function aggregateByNote(chunks: ScoredChunk[], scoreOf: (c: ScoredChunk) => number): NoteRow[] {
  const buckets = new Map<string, ScoredChunk[]>();
  for (const c of chunks) {
    const arr = buckets.get(c.noteId) ?? [];
    arr.push(c);
    buckets.set(c.noteId, arr);
  }
  const rows: NoteRow[] = [];
  for (const [noteId, arr] of buckets) {
    arr.sort((a, b) => scoreOf(b) - scoreOf(a));
    const top = arr.slice(0, NOTE_TOP_CHUNKS);
    const totalScore = top.reduce((acc, c) => acc + scoreOf(c), 0);
    rows.push({
      noteId,
      title: arr[0].noteTitle,
      totalScore,
      bestChunkText: arr[0].text,
      bestHeadingPath: arr[0].headingPath,
      contributingChunks: top.length,
    });
  }
  rows.sort((a, b) => b.totalScore - a.totalScore);
  return rows;
}

function trimSnippet(text: string, max = 120): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max).trim()}…`;
}

function printSideBySide(query: string, before: NoteRow[], after: NoteRow[], latencyMs: number) {
  const beforeIdxByNote = new Map(before.slice(0, TOP_K).map((r, i) => [r.noteId, i]));

  console.log(`\nquery: ${JSON.stringify(query)}   rerank latency: ${latencyMs.toFixed(0)}ms`);
  console.log('  pre-rerank (RRF only):');
  if (before.length === 0) console.log('    (no hits)');
  for (let i = 0; i < Math.min(TOP_K, before.length); i += 1) {
    const r = before[i];
    console.log(`    ${i + 1}. ${r.title}   ›   ${r.bestHeadingPath.join(' › ') || '(root)'}`);
  }
  console.log('  post-rerank (cross-encoder):');
  if (after.length === 0) console.log('    (no hits)');
  for (let i = 0; i < Math.min(TOP_K, after.length); i += 1) {
    const r = after[i];
    const prev = beforeIdxByNote.get(r.noteId);
    const delta =
      prev === undefined ? '(new)' : prev === i ? '(=)' : `(was #${prev + 1}, ${prev - i > 0 ? '↑' : '↓'}${Math.abs(prev - i)})`;
    console.log(`    ${i + 1}. ${r.title}   ›   ${r.bestHeadingPath.join(' › ') || '(root)'}   ${delta}`);
    console.log(`        “${trimSnippet(r.bestChunkText)}”`);
  }
}

async function main() {
  const queries = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_QUERIES;

  const dbPath = resolveDbPath();
  console.log(`db: ${dbPath}`);
  console.log(`queries: ${queries.map((q) => JSON.stringify(q)).join(', ')}\n`);

  const client = createClient({ url: `file:${dbPath}` });
  console.log('Loading chunks…');
  const rs = await client.execute(`
    SELECT c.id AS id, c.note_id AS note_id, c.heading_path AS heading_path,
           c.text AS text, c.embedding AS embedding,
           n.title AS title
    FROM note_chunks c
    JOIN notes n ON n.id = c.note_id
    WHERE c.embedding IS NOT NULL AND n.is_deleted = 0
  `);

  const chunks: Chunk[] = [];
  const byChunkId = new Map<string, Chunk>();
  const embeddings = new Map<string, Float32Array>();
  for (const row of rs.rows as Array<Record<string, unknown>>) {
    const vec = decodeEmbedding(row.embedding);
    if (!vec || vec.length !== EMBEDDING_DIMS) continue;
    const headingPath = (() => {
      try {
        const p = JSON.parse(String(row.heading_path ?? '[]'));
        return Array.isArray(p) ? p.map(String) : [];
      } catch {
        return [];
      }
    })();
    const chunk: Chunk = {
      id: String(row.id),
      noteId: String(row.note_id),
      noteTitle: (row.title as string | null) ?? '<untitled>',
      headingPath,
      text: String(row.text ?? ''),
    };
    chunks.push(chunk);
    byChunkId.set(chunk.id, chunk);
    embeddings.set(chunk.id, vec);
  }
  console.log(`  ${chunks.length} chunks with embeddings`);

  console.log('Loading embedder (bge-small)…');
  const embed = await loadEmbedder();
  console.log('Loading reranker (ms-marco MiniLM-L-6)…');
  const rerank = await loadReranker();

  for (const query of queries) {
    const queryVec = await embed(query);
    const ftsHits = await runFts(client, query, byChunkId);
    const vecHits = runVector(queryVec, chunks, embeddings);
    const merged = rrfMerge(ftsHits, vecHits);

    const beforeRows = aggregateByNote(merged, (c) => c.rrfScore).slice(0, TOP_K);

    const pool = merged.slice(0, RERANK_POOL);
    const tStart = Date.now();
    const scores = pool.length > 0 ? await rerank(query, pool.map((c) => c.text)) : [];
    const latencyMs = Date.now() - tStart;

    for (let i = 0; i < pool.length; i += 1) {
      pool[i].rerankScore = scores[i];
    }
    // Reranked chunks dominate via sigmoid; untouched tail keeps RRF score.
    const afterRows = aggregateByNote(merged, (c) =>
      c.rerankScore !== undefined ? sigmoid(c.rerankScore) : c.rrfScore,
    ).slice(0, TOP_K);

    printSideBySide(query, beforeRows, afterRows, latencyMs);
  }

  client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
