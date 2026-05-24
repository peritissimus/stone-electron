/**
 * suggest-topics.ts
 *
 * Run the TopicSuggester against the live chunk index and print the
 * candidate clusters. Mirrors what the in-app `topics:getSuggestions` IPC
 * returns — useful for tuning the threshold/min-size knobs before shipping.
 *
 * Usage:
 *   pnpm exec tsx scripts/suggest-topics.ts
 *   pnpm exec tsx scripts/suggest-topics.ts --threshold 0.6 --min 3
 */
import { createClient } from '@libsql/client';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  TopicSuggester,
  type SuggesterChunk,
} from '../src/main/domain/services/TopicSuggester';

function resolveDbPath(): string {
  if (process.env.STONE_DB) return process.env.STONE_DB;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/stone/stone-data/notes.db');
  }
  if (process.platform === 'linux') {
    return path.join(os.homedir(), '.config/stone/stone-data/notes.db');
  }
  throw new Error('Set STONE_DB');
}

function decode(raw: unknown): Float32Array | null {
  if (raw instanceof ArrayBuffer) return new Float32Array(raw);
  if (raw instanceof Uint8Array)
    return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  return null;
}

function flag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

async function main() {
  const threshold = Number(flag('threshold', '0.55'));
  const minSize = Number(flag('min', '4'));
  const maxClusters = Number(flag('max', '12'));

  const dbPath = resolveDbPath();
  console.log(`db: ${dbPath}`);
  console.log(`opts: threshold=${threshold}  min=${minSize}  max=${maxClusters}\n`);

  const client = createClient({ url: `file:${dbPath}` });

  const ws = await client.execute(
    `SELECT id, folder_path FROM workspaces WHERE is_active = 1 LIMIT 1`,
  );
  if (ws.rows.length === 0) {
    console.error('no active workspace');
    client.close();
    process.exit(1);
  }
  const workspaceId = String((ws.rows[0] as Record<string, unknown>).id);

  const rs = await client.execute({
    sql: `SELECT c.id AS chunk_id, c.note_id AS note_id, c.heading_path AS heading_path,
                 c.text AS text, c.embedding AS embedding, n.title AS title
          FROM note_chunks c
          JOIN notes n ON n.id = c.note_id
          WHERE c.embedding IS NOT NULL AND c.workspace_id = ?`,
    args: [workspaceId],
  });
  console.log(`loaded ${rs.rows.length} chunks from workspace`);

  const chunks: SuggesterChunk[] = [];
  for (const row of rs.rows as Array<Record<string, unknown>>) {
    const vec = decode(row.embedding);
    if (!vec) continue;
    let headingPath: string[] = [];
    try {
      const parsed = JSON.parse(String(row.heading_path ?? '[]'));
      if (Array.isArray(parsed)) headingPath = parsed.map((v) => String(v));
    } catch {
      headingPath = [];
    }
    chunks.push({
      chunkId: String(row.chunk_id),
      noteId: String(row.note_id),
      noteTitle: (row.title as string | null) ?? 'Untitled',
      headingPath,
      text: String(row.text ?? ''),
      embedding: Array.from(vec),
    });
  }
  console.log(`usable chunks: ${chunks.length}\n`);

  const started = Date.now();
  const clusters = TopicSuggester.suggest(chunks, {
    cosineThreshold: threshold,
    minClusterSize: minSize,
    maxClusters,
    representativesPerCluster: 3,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(2);

  console.log(`generated ${clusters.length} clusters in ${elapsed}s\n`);

  for (const cluster of clusters) {
    console.log(
      `▸ ${cluster.label}   ${cluster.noteCount} notes · ${cluster.chunkCount} chunks · ${(cluster.cohesion * 100).toFixed(0)}% cohesion`,
    );
    if (cluster.altLabels.length > 0) {
      console.log(`   alt: ${cluster.altLabels.join(', ')}`);
    }
    for (const rep of cluster.representatives) {
      const heading =
        rep.headingPath.length > 0 ? ` › ${rep.headingPath.join(' › ')}` : '';
      console.log(`   · ${rep.noteTitle}${heading}`);
      console.log(`       "${rep.excerpt.slice(0, 120)}${rep.excerpt.length > 120 ? '…' : ''}"`);
    }
    console.log('');
  }

  client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
