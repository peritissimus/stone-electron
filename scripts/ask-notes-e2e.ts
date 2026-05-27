/**
 * ask-notes-e2e.ts
 *
 * Runs the full AskNotes retrieval pipeline against the live db, exactly the
 * way the in-app use case does it:
 *
 *   query → embed → cosine over note vectors → load top-N markdown from disk
 *   → optionally call the LLM if OPENAI_API_KEY is set
 *
 * Prints the candidate notes and snippets so you can see what AskNotes would
 * have sent to the model.
 *
 * Usage:
 *   pnpm exec tsx scripts/ask-notes-e2e.ts "your question"
 *   OPENAI_API_KEY=sk-... pnpm exec tsx scripts/ask-notes-e2e.ts "your question"
 */
import { createClient } from '@libsql/client';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const MODEL_NAME = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIMS = 384;
const TOP_N = 5;
const MAX_EXCERPT = 1400;

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

function stripMarkdown(markdown: string): string {
  if (!markdown.trim()) return '';
  return markdown
    .replaceAll(/```[\s\S]*?```/g, '')
    .replaceAll(/#{1,6}\s+/g, '')
    .replaceAll(/\*\*([^*]+)\*\*/g, '$1')
    .replaceAll(/\*([^*]+)\*/g, '$1')
    .replaceAll(/`([^`]+)`/g, '$1')
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replaceAll(/\[\[([^\]]+)\]\]/g, '$1')
    .replaceAll(/^[-*+]\s+/gm, '')
    .replaceAll(/^\d+\.\s+/gm, '')
    .replaceAll(/^>\s+/gm, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEmbedding(raw: unknown): Float32Array | null {
  if (raw instanceof ArrayBuffer) {
    return new Float32Array(raw);
  }
  if (raw instanceof Uint8Array) {
    return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  }
  return null;
}

function cosineSimilarity(a: Float32Array | number[], b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < b.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function loadEmbedder() {
  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  env.cacheDir = resolveCacheDir();
  const extractor = await pipeline('feature-extraction', MODEL_NAME, { quantized: true });
  return async (text: string): Promise<Float32Array> => {
    const output = (await extractor(text, { pooling: 'mean', normalize: true })) as {
      data: Float32Array;
    };
    return output.data;
  };
}

interface Source {
  rank: number;
  noteId: string;
  title: string;
  similarity: number;
  excerpt: string;
}

function truncate(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}…`;
}

async function callOpenAI(query: string, sources: Source[]): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (sources.length === 0) return null;

  let generateText: typeof import('ai').generateText;
  let createOpenAI: typeof import('@ai-sdk/openai').createOpenAI;
  try {
    ({ generateText } = await import('ai'));
    ({ createOpenAI } = await import('@ai-sdk/openai'));
  } catch (err) {
    console.log(`(LLM step skipped — ai sdk import failed: ${(err as Error).message})`);
    return null;
  }

  const openai = createOpenAI({ apiKey: key });
  const system = [
    'You answer questions using only the provided note excerpts.',
    'If the excerpts do not contain enough information, say that clearly.',
    'Cite sources inline using their source numbers, for example [1] or [2].',
    'Do not invent citations or facts that are not present in the excerpts.',
  ].join('\n');

  const sourcesBlock = sources
    .map((s) => `[${s.rank}]\nTitle: ${s.title}\nExcerpt:\n${s.excerpt}`)
    .join('\n\n');

  const prompt = `Question: ${query}\n\nSources:\n${sourcesBlock}`;

  try {
    const result = await generateText({
      model: openai('gpt-5.4-mini'),
      system,
      prompt,
      temperature: 0.2,
    });
    return result.text;
  } catch (err) {
    console.log(`(LLM call failed: ${(err as Error).message})`);
    return null;
  }
}

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: pnpm exec tsx scripts/ask-notes-e2e.ts "your question"');
    process.exit(1);
  }

  const dbPath = resolveDbPath();
  console.log(`db:    ${dbPath}`);
  console.log(`query: ${JSON.stringify(query)}\n`);

  const client = createClient({ url: `file:${dbPath}` });

  console.log('Embedding query…');
  const embed = await loadEmbedder();
  const queryVec = await embed(query);

  console.log('Scoring against chunk embeddings…');
  const rs = await client.execute(`
    SELECT c.id AS chunk_id, c.note_id AS note_id, c.heading_path AS heading_path,
           c.text AS text, c.embedding AS embedding,
           n.title AS title, n.file_path AS file_path
    FROM note_chunks c
    JOIN notes n ON n.id = c.note_id
    WHERE c.embedding IS NOT NULL AND n.is_deleted = 0
  `);

  // Aggregate per note: best chunk wins (max-pooled), like AskNotes ranks.
  const bestByNote = new Map<
    string,
    {
      title: string;
      filePath: string;
      similarity: number;
      bestChunk: { text: string; headingPath: string[] };
      matched: number;
    }
  >();
  for (const row of rs.rows as Array<Record<string, unknown>>) {
    const vec = decodeEmbedding(row.embedding);
    if (!vec || vec.length !== EMBEDDING_DIMS) continue;
    const similarity = cosineSimilarity(queryVec, vec);
    const noteId = String(row.note_id);
    const existing = bestByNote.get(noteId);
    const headingPath = (() => {
      try {
        const parsed = JSON.parse(String(row.heading_path ?? '[]'));
        return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
      } catch {
        return [];
      }
    })();
    if (!existing) {
      bestByNote.set(noteId, {
        title: (row.title as string | null) || '<untitled>',
        filePath: String(row.file_path ?? ''),
        similarity,
        bestChunk: { text: String(row.text ?? ''), headingPath },
        matched: 1,
      });
    } else {
      existing.matched += 1;
      if (similarity > existing.similarity) {
        existing.similarity = similarity;
        existing.bestChunk = { text: String(row.text ?? ''), headingPath };
      }
    }
  }

  const scored = [...bestByNote.entries()].map(([id, b]) => ({ id, ...b }));
  scored.sort((a, b) => b.similarity - a.similarity);
  const top = scored.slice(0, TOP_N);
  console.log(`Scored ${scored.length} notes via chunks · top ${top.length}:\n`);

  const sources: Source[] = [];
  for (let i = 0; i < top.length; i += 1) {
    const t = top[i];
    const heading =
      t.bestChunk.headingPath.length > 0 ? t.bestChunk.headingPath.join(' › ') : '(root)';
    const similarityPct = (t.similarity * 100).toFixed(1);
    console.log(`  [${i + 1}] ${similarityPct}%  ${t.title}  ›  ${heading}`);
    console.log(`        ${t.filePath}  (best of ${t.matched} chunks)`);
    const excerpt = truncate(t.bestChunk.text.replace(/\s+/g, ' '), MAX_EXCERPT);
    const preview = truncate(t.bestChunk.text.replace(/\s+/g, ' '), 140);
    console.log(`        “${preview}”`);
    sources.push({ rank: i + 1, noteId: t.id, title: t.title, similarity: t.similarity, excerpt });
  }

  console.log(`\nUsable sources: ${sources.length}`);

  if (sources.length === 0) {
    console.log('→ AskNotes would return the canned "could not find relevant notes" message.');
    client.close();
    return;
  }

  console.log('→ AskNotes would build these sources and call the LLM.\n');

  const answer = await callOpenAI(query, sources);
  if (answer) {
    console.log('---------- LLM answer (gpt-5.4-mini) ----------');
    console.log(answer);
    console.log('-----------------------------------------------');
  } else {
    console.log(
      '(No OPENAI_API_KEY in env, skipping LLM call. Set OPENAI_API_KEY=sk-… to test the full pipeline.)',
    );
  }

  client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
