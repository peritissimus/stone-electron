/**
 * diagnose-ask-notes.ts
 *
 * Reproduces what AskNotesUseCase sees at runtime by inspecting the live
 * userData SQLite db. Confirms the two reasons AskNotes returns the canned
 * "I could not find relevant notes to answer that." message:
 *
 *   1. SearchEngine.searchFullText() is title-LIKE only — no notes_fts.
 *   2. Embedder.semanticSearch() returns [] (stub) — semantic half is dead.
 *
 * Usage:
 *   pnpm exec tsx scripts/diagnose-ask-notes.ts "your question here"
 */
import { createClient, type Client } from '@libsql/client';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const HOME = os.homedir();
const MAC_DEFAULT = path.join(HOME, 'Library/Application Support/stone/stone-data/notes.db');
const LINUX_DEFAULT = path.join(HOME, '.config/stone/stone-data/notes.db');

function resolveDbPath(): string {
  if (process.env.STONE_DB) return process.env.STONE_DB;
  if (process.platform === 'darwin') return MAC_DEFAULT;
  if (process.platform === 'linux') return LINUX_DEFAULT;
  throw new Error(`No default db path for ${process.platform}. Set STONE_DB=/path/to/notes.db`);
}

function fmt(n: number, total: number): string {
  if (total === 0) return `${n}`;
  return `${n} (${Math.round((n / total) * 100)}%)`;
}

async function countOne(client: Client, sql: string, args: unknown[] = []): Promise<number> {
  const rs = await client.execute({ sql, args: args as any });
  const row = rs.rows[0] as Record<string, unknown> | undefined;
  return Number((row?.['c'] as number | bigint | undefined) ?? 0);
}

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: pnpm exec tsx scripts/diagnose-ask-notes.ts "your question here"');
    process.exit(1);
  }

  const dbPath = resolveDbPath();
  console.log(`db: ${dbPath}\nquery: ${JSON.stringify(query)}\n`);

  const client = createClient({ url: `file:${dbPath}` });

  // ---- workspaces ----
  const ws = await client.execute(`SELECT id, name, is_active FROM workspaces`);
  console.log(`workspaces: ${ws.rows.length}`);
  for (const row of ws.rows) {
    const r = row as Record<string, unknown>;
    console.log(`  ${r.is_active ? '*' : ' '} ${r.name} (${r.id})`);
  }

  // ---- notes total / embedded ----
  const total = await countOne(client, `SELECT COUNT(*) AS c FROM notes WHERE is_deleted = 0`);
  const embedded = await countOne(
    client,
    `SELECT COUNT(*) AS c FROM notes WHERE is_deleted = 0 AND embedding IS NOT NULL`,
  );
  console.log(`\nnotes (not deleted): ${total}`);
  console.log(`  with embedding:    ${fmt(embedded, total)}`);
  console.log(`  without embedding: ${fmt(total - embedded, total)}`);

  // ---- step 1: SearchEngine.searchFullText (title LIKE) ----
  const searchQuery = query.replace(/[^\w\s]/g, ' ').trim();
  const titleRs = await client.execute({
    sql: `SELECT id, title FROM notes
          WHERE is_deleted = 0 AND title LIKE ?
          ORDER BY updated_at DESC LIMIT 20`,
    args: [`%${searchQuery}%`],
  });
  console.log(`\n[searchFullText] title LIKE %${searchQuery}%: ${titleRs.rows.length} match(es)`);
  for (const row of titleRs.rows.slice(0, 10)) {
    const r = row as Record<string, unknown>;
    console.log(`  - ${(r.title as string) || '<untitled>'}  (${r.id})`);
  }

  // Also try each word separately — closer to what users actually ask
  const tokens = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (tokens.length > 1) {
    const orClause = tokens.map(() => `LOWER(title) LIKE ?`).join(' OR ');
    const tokenMatches = await countOne(
      client,
      `SELECT COUNT(*) AS c FROM notes WHERE is_deleted = 0 AND (${orClause})`,
      tokens.map((t) => `%${t}%`),
    );
    console.log(
      `[searchFullText] title LIKE ANY of [${tokens.join(', ')}]: ${tokenMatches} match(es)`,
    );
  }

  // ---- step 2: notes_fts existence ----
  const hasFtsRs = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'`,
  );
  const hasFts = hasFtsRs.rows.length > 0;
  console.log(`\n[notes_fts] table exists: ${hasFts ? 'yes' : 'NO'}`);
  if (!hasFts) {
    console.log('  → searchFullText cannot fall back to full-text content search.');
  }

  // ---- step 3: semantic search reachability ----
  // Mirrors NoteRepository.findBySimilarity: cosine over every note with a
  // non-null embedding blob. We check the BLOB layout is readable; libsql's
  // raw client returns ArrayBuffer, Drizzle returns Buffer — accept both.
  const embedRs = await client.execute(
    `SELECT id, title, embedding FROM notes
     WHERE is_deleted = 0 AND embedding IS NOT NULL`,
  );
  let readable = 0;
  let dims = 0;
  for (const row of embedRs.rows) {
    const raw = (row as Record<string, unknown>).embedding;
    let byteLength: number | null = null;
    if (raw instanceof ArrayBuffer) byteLength = raw.byteLength;
    else if (raw instanceof Uint8Array) byteLength = raw.byteLength;
    if (byteLength === null || byteLength % 4 !== 0) continue;
    if (!dims) dims = byteLength / 4;
    readable += 1;
  }
  console.log(
    `\n[semanticSearch] embeddings readable: ${readable}/${embedRs.rows.length}  ` +
      `(dims=${dims || 'unknown'})`,
  );
  if (readable === 0) {
    console.log(
      `  → no usable note vectors. Make sure the embedding worker has run (Topics → reclassify).`,
    );
  } else {
    console.log(
      `  → after the Embedder.semanticSearch fix, AskNotes can rank these ${readable} notes`,
    );
    console.log(`     by cosine similarity to the query embedding.`);
  }

  // ---- verdict ----
  console.log(`\n=== verdict ===`);
  const ftsCandidates = titleRs.rows.length;
  const semanticCandidates = readable;
  const totalCandidates = Math.min(50, ftsCandidates + semanticCandidates);
  console.log(`AskNotes ← searchHybrid:`);
  console.log(`  FTS half (title LIKE):     ${ftsCandidates} candidate(s)`);
  console.log(`  semantic half (cosine):    up to ${Math.min(20, semanticCandidates)} candidate(s) post-fix`);
  console.log(`  combined (capped at 50):   ${totalCandidates}`);
  if (totalCandidates === 0) {
    console.log(
      `→ AskNotesUseCase builds zero sources → AISDKTextGenerator returns the canned message.`,
    );
  } else {
    console.log(
      `→ AskNotesUseCase will build sources from the top candidates and call the LLM.`,
    );
  }

  client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
