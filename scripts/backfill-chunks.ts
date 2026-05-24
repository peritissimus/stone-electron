/**
 * backfill-chunks.ts
 *
 * One-shot script that chunks + embeds every note that doesn't have an
 * up-to-date chunk index. Mirrors what IndexNoteUseCase does in-app, but
 * runs outside Electron against the live DB.
 *
 * After this runs, AskNotes / Knowledge semantic search use chunk-level
 * retrieval instead of the legacy note-level embeddings.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-chunks.ts
 *   pnpm exec tsx scripts/backfill-chunks.ts --force   # re-index everything
 */
import { createClient } from '@libsql/client';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { NoteChunker } from '../src/main/domain/services/NoteChunker';
import { hashText } from '../src/main/domain/services/hashText';

const MODEL = 'Xenova/bge-small-en-v1.5';
const DIMS = 384;

function resolveDbPath(): string {
  if (process.env.STONE_DB) return process.env.STONE_DB;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/stone/stone-data/notes.db');
  }
  if (process.platform === 'linux') {
    return path.join(os.homedir(), '.config/stone/stone-data/notes.db');
  }
  throw new Error('No default db path. Set STONE_DB=/path/to/notes.db');
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

async function loadEmbedder() {
  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  env.cacheDir = resolveCacheDir();
  const extractor = await pipeline('feature-extraction', MODEL, { quantized: true });
  return async (text: string): Promise<Float32Array> => {
    if (!text.trim()) return new Float32Array(DIMS);
    const output = (await extractor(text, { pooling: 'mean', normalize: true })) as {
      data: Float32Array;
    };
    return output.data;
  };
}

async function main() {
  const force = process.argv.includes('--force');
  const dbPath = resolveDbPath();
  console.log(`db: ${dbPath}${force ? '  (--force)' : ''}\n`);
  const client = createClient({ url: `file:${dbPath}` });

  // Inventory
  const notesRs = await client.execute(`
    SELECT n.id AS id, n.title AS title, n.file_path AS file_path,
           n.workspace_id AS workspace_id,
           w.folder_path AS workspace_path
    FROM notes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE n.is_deleted = 0 AND n.file_path IS NOT NULL
    ORDER BY n.updated_at DESC
  `);

  const total = notesRs.rows.length;
  console.log(`notes to consider: ${total}`);

  // Load existing index status to skip unchanged
  const statusRs = await client.execute(
    `SELECT note_id, content_hash, status, chunk_count FROM note_index_records`,
  );
  const statusByNoteId = new Map<string, { hash: string; status: string; chunkCount: number }>();
  for (const row of statusRs.rows as Array<Record<string, unknown>>) {
    statusByNoteId.set(String(row.note_id), {
      hash: String(row.content_hash),
      status: String(row.status),
      chunkCount: Number(row.chunk_count ?? 0),
    });
  }

  console.log(`already-indexed entries: ${statusByNoteId.size}\n`);
  console.log(`loading model ${MODEL}…`);
  const embed = await loadEmbedder();

  let indexed = 0;
  let skipped = 0;
  let failed = 0;
  let chunksWritten = 0;
  const startedAt = Date.now();

  for (let i = 0; i < total; i += 1) {
    const row = notesRs.rows[i] as Record<string, unknown>;
    const noteId = String(row.id);
    const title = (row.title as string | null) || '<untitled>';
    const filePath = String(row.file_path);
    const workspaceId = String(row.workspace_id);
    const workspaceRoot = String(row.workspace_path);
    const absolute = path.join(workspaceRoot, filePath);
    const prefix = `[${i + 1}/${total}]`;

    try {
      const markdown = await fs.readFile(absolute, 'utf8').catch(() => null);
      if (markdown === null) {
        console.log(`${prefix} SKIP (file missing): ${filePath}`);
        skipped += 1;
        continue;
      }
      const contentHash = hashText(markdown);
      const existing = statusByNoteId.get(noteId);
      if (!force && existing && existing.status === 'indexed' && existing.hash === contentHash) {
        skipped += 1;
        continue;
      }

      const chunks = NoteChunker.chunk(noteId, markdown);
      if (chunks.length === 0) {
        // Wipe + mark indexed-with-zero so future runs don't reprocess.
        await client.batch(
          [
            { sql: `DELETE FROM note_chunks_fts WHERE note_id = ?`, args: [noteId] },
            { sql: `DELETE FROM note_chunks WHERE note_id = ?`, args: [noteId] },
            {
              sql: `INSERT INTO note_index_records (note_id, workspace_id, content_hash, chunk_count, indexed_at, model, dimensions, status, error)
                    VALUES (?, ?, ?, 0, ?, ?, ?, 'indexed', NULL)
                    ON CONFLICT(note_id) DO UPDATE SET
                      workspace_id = excluded.workspace_id,
                      content_hash = excluded.content_hash,
                      chunk_count = 0,
                      indexed_at = excluded.indexed_at,
                      model = excluded.model,
                      dimensions = excluded.dimensions,
                      status = 'indexed',
                      error = NULL`,
              args: [noteId, workspaceId, contentHash, Math.floor(Date.now() / 1000), MODEL, DIMS],
            },
          ],
          'write',
        );
        console.log(`${prefix} OK (0 chunks): ${title}`);
        indexed += 1;
        continue;
      }

      // Embed chunks
      const vectors: Float32Array[] = [];
      for (const chunk of chunks) {
        vectors.push(await embed(chunk.text));
      }

      // Persist atomically
      const now = Math.floor(Date.now() / 1000);
      const statements: { sql: string; args: unknown[] }[] = [
        { sql: `DELETE FROM note_chunks_fts WHERE note_id = ?`, args: [noteId] },
        { sql: `DELETE FROM note_chunks WHERE note_id = ?`, args: [noteId] },
      ];
      for (let j = 0; j < chunks.length; j += 1) {
        const chunk = chunks[j];
        const vec = vectors[j];
        const blob = Buffer.from(vec.buffer.slice(vec.byteOffset, vec.byteOffset + vec.byteLength));
        statements.push({
          sql: `INSERT INTO note_chunks (id, note_id, workspace_id, chunk_index, heading_path, text, content_hash, token_count, embedding, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            chunk.id,
            noteId,
            workspaceId,
            chunk.index,
            JSON.stringify(chunk.headingPath),
            chunk.text,
            hashText(chunk.text),
            chunk.tokenCount,
            blob,
            now,
            now,
          ],
        });
        statements.push({
          sql: `INSERT INTO note_chunks_fts (chunk_id, note_id, workspace_id, title, heading_path, text)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [chunk.id, noteId, workspaceId, title, chunk.headingPath.join(' › '), chunk.text],
        });
      }
      statements.push({
        sql: `INSERT INTO note_index_records (note_id, workspace_id, content_hash, chunk_count, indexed_at, model, dimensions, status, error)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'indexed', NULL)
              ON CONFLICT(note_id) DO UPDATE SET
                workspace_id = excluded.workspace_id,
                content_hash = excluded.content_hash,
                chunk_count = excluded.chunk_count,
                indexed_at = excluded.indexed_at,
                model = excluded.model,
                dimensions = excluded.dimensions,
                status = 'indexed',
                error = NULL`,
        args: [noteId, workspaceId, contentHash, chunks.length, now, MODEL, DIMS],
      });

      await client.batch(statements, 'write');
      chunksWritten += chunks.length;
      indexed += 1;
      console.log(`${prefix} OK (${chunks.length} chunks): ${title}`);
    } catch (e) {
      console.log(`${prefix} FAIL: ${title} · ${(e as Error).message}`);
      failed += 1;
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\nDone in ${elapsed}s · ${indexed} indexed (${chunksWritten} chunks) · ${skipped} skipped · ${failed} failed`,
  );

  client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
