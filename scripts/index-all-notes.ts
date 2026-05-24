/**
 * index-all-notes.ts
 *
 * Backfills embeddings for every note that doesn't have one yet, using the
 * same model + format the running app uses (Xenova/bge-small-en-v1.5, 384
 * dims, Float32Array packed as a Buffer in the notes.embedding BLOB column).
 *
 * Safe to re-run — only notes WHERE embedding IS NULL are touched. Notes
 * without a filePath are skipped.
 *
 * Usage:
 *   pnpm exec tsx scripts/index-all-notes.ts
 */
import { createClient } from '@libsql/client';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const MODEL_NAME = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIMS = 384;

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

async function loadEmbeddingPipeline() {
  console.log(`Loading embedding model "${MODEL_NAME}"…`);
  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  env.cacheDir = resolveCacheDir();
  const extractor = await pipeline('feature-extraction', MODEL_NAME, { quantized: true });
  return async (text: string): Promise<Float32Array> => {
    if (!text.trim()) return new Float32Array(EMBEDDING_DIMS);
    const output = (await extractor(text, { pooling: 'mean', normalize: true })) as {
      data: Float32Array;
    };
    return output.data;
  };
}

async function main() {
  const dbPath = resolveDbPath();
  console.log(`db: ${dbPath}`);
  const client = createClient({ url: `file:${dbPath}` });

  const totalRs = await client.execute(
    `SELECT COUNT(*) AS c FROM notes WHERE is_deleted = 0`,
  );
  const indexedRs = await client.execute(
    `SELECT COUNT(*) AS c FROM notes WHERE is_deleted = 0 AND embedding IS NOT NULL`,
  );
  const total = Number((totalRs.rows[0] as Record<string, unknown>).c);
  const alreadyIndexed = Number((indexedRs.rows[0] as Record<string, unknown>).c);
  const pending = total - alreadyIndexed;
  console.log(`notes: ${total} total · ${alreadyIndexed} already indexed · ${pending} pending\n`);

  if (pending === 0) {
    console.log('Nothing to do.');
    client.close();
    return;
  }

  const pendingRs = await client.execute(`
    SELECT n.id AS id, n.title AS title, n.file_path AS file_path,
           w.folder_path AS workspace_path
    FROM notes n
    JOIN workspaces w ON w.id = n.workspace_id
    WHERE n.is_deleted = 0
      AND n.embedding IS NULL
      AND n.file_path IS NOT NULL
  `);
  const rows = pendingRs.rows as Array<Record<string, unknown>>;
  console.log(`Will attempt to index ${rows.length} note(s).\n`);

  const embed = await loadEmbeddingPipeline();

  let success = 0;
  let skipped = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const id = String(row.id);
    const title = (row.title as string | null) || '<untitled>';
    const filePath = String(row.file_path);
    const workspacePath = String(row.workspace_path);
    const fullPath = path.join(workspacePath, filePath);
    const prefix = `[${i + 1}/${rows.length}]`;

    try {
      const markdown = await fs.readFile(fullPath, 'utf8').catch(() => null);
      if (!markdown) {
        console.log(`${prefix} SKIP (file missing): ${filePath}`);
        skipped += 1;
        continue;
      }
      const plain = stripMarkdown(markdown);
      if (!plain) {
        console.log(`${prefix} SKIP (empty after strip): ${title}`);
        skipped += 1;
        continue;
      }

      const vector = await embed(plain);
      if (vector.length !== EMBEDDING_DIMS) {
        console.log(`${prefix} FAIL (dims ${vector.length}): ${title}`);
        failed += 1;
        continue;
      }

      const blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
      await client.execute({
        sql: `UPDATE notes SET embedding = ? WHERE id = ?`,
        args: [blob, id],
      });
      console.log(`${prefix} OK · ${title}`);
      success += 1;
    } catch (err) {
      console.log(`${prefix} ERROR · ${title} · ${(err as Error).message}`);
      failed += 1;
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\nDone in ${elapsed}s · ${success} indexed · ${skipped} skipped · ${failed} failed`,
  );

  const finalIndexedRs = await client.execute(
    `SELECT COUNT(*) AS c FROM notes WHERE is_deleted = 0 AND embedding IS NOT NULL`,
  );
  const finalIndexed = Number((finalIndexedRs.rows[0] as Record<string, unknown>).c);
  console.log(`Final: ${finalIndexed} / ${total} notes indexed`);

  client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
