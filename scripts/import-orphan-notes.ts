/**
 * import-orphan-notes.ts
 *
 * Finds every .md file in the active workspace that has no row in the notes
 * table and creates one. After this runs, every markdown file is a "real"
 * note: searchable, embeddable, classifiable. Run scripts/index-all-notes.ts
 * afterwards to backfill embeddings for the freshly-imported rows.
 *
 * Title extraction (in order of precedence):
 *   1. YAML frontmatter `title:` field
 *   2. First `# Heading` line
 *   3. Filename without extension
 *
 * Timestamps come from the file's stat (created → birthtime, updated → mtime),
 * stored as seconds since epoch to match the existing schema.
 *
 * Safe to re-run — only files NOT already in the notes table are inserted.
 *
 * Usage:
 *   pnpm exec tsx scripts/import-orphan-notes.ts
 *   pnpm exec tsx scripts/import-orphan-notes.ts --dry-run
 */
import { createClient } from '@libsql/client';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { nanoid } from 'nanoid';

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

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

function extractTitle(markdown: string, fallbackFilename: string): string {
  // 1. YAML frontmatter
  if (markdown.startsWith('---\n')) {
    const end = markdown.indexOf('\n---', 4);
    if (end !== -1) {
      const fm = markdown.slice(4, end);
      const match = fm.match(/^title:\s*(.+)$/m);
      if (match) {
        return match[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }

  // 2. First # heading
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) return heading[1].trim();
    // Stop on first non-blank, non-heading line
    break;
  }

  // 3. Filename without .md
  return fallbackFilename.replace(/\.md$/i, '');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dbPath = resolveDbPath();
  console.log(`db: ${dbPath}${dryRun ? '  (dry run)' : ''}`);

  const client = createClient({ url: `file:${dbPath}` });

  // Active workspace
  const wsRs = await client.execute(
    `SELECT id, folder_path FROM workspaces WHERE is_active = 1 LIMIT 1`,
  );
  if (wsRs.rows.length === 0) {
    console.error('No active workspace.');
    client.close();
    process.exit(1);
  }
  const workspaceId = String((wsRs.rows[0] as Record<string, unknown>).id);
  const workspaceRoot = String((wsRs.rows[0] as Record<string, unknown>).folder_path);
  console.log(`workspace: ${workspaceRoot}  (id=${workspaceId})\n`);

  // Inventory
  const onDisk = (await walk(workspaceRoot))
    .map((p) => path.relative(workspaceRoot, p))
    .sort();
  const inDbRs = await client.execute(
    `SELECT file_path FROM notes WHERE is_deleted = 0 AND file_path IS NOT NULL`,
  );
  const inDb = new Set(
    inDbRs.rows.map((r) => String((r as Record<string, unknown>).file_path)),
  );

  const orphans = onDisk.filter((p) => !inDb.has(p));
  console.log(`on disk: ${onDisk.length} markdown files`);
  console.log(`in db:   ${inDb.size} notes`);
  console.log(`orphan:  ${orphans.length}\n`);

  if (orphans.length === 0) {
    console.log('Nothing to import.');
    client.close();
    return;
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < orphans.length; i += 1) {
    const rel = orphans[i];
    const abs = path.join(workspaceRoot, rel);
    const prefix = `[${i + 1}/${orphans.length}]`;

    try {
      const stat = await fs.stat(abs);
      const markdown = await fs.readFile(abs, 'utf8');
      const title = extractTitle(markdown, path.basename(rel));
      const id = nanoid();

      const createdAt = Math.floor(stat.birthtimeMs / 1000) || Math.floor(stat.mtimeMs / 1000);
      const updatedAt = Math.floor(stat.mtimeMs / 1000);

      if (dryRun) {
        console.log(`${prefix} would insert  ${title}  ←  ${rel}`);
        skipped += 1;
        continue;
      }

      await client.execute({
        sql: `INSERT INTO notes (
                id, title, file_path, notebook_id, workspace_id,
                is_favorite, is_pinned, is_archived, is_deleted,
                created_at, updated_at
              ) VALUES (?, ?, ?, NULL, ?, 0, 0, 0, 0, ?, ?)`,
        args: [id, title, rel, workspaceId, createdAt, updatedAt],
      });
      console.log(`${prefix} OK  ${title}  ←  ${rel}`);
      inserted += 1;
    } catch (err) {
      console.log(`${prefix} FAIL  ${rel}  ${(err as Error).message}`);
      failed += 1;
    }
  }

  console.log(
    `\n${dryRun ? 'dry run' : 'done'} · ${inserted} inserted · ${skipped} skipped · ${failed} failed`,
  );

  if (!dryRun && inserted > 0) {
    console.log(
      `\nNext: run \`pnpm exec tsx scripts/index-all-notes.ts\` to embed the new rows.`,
    );
  }

  client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
