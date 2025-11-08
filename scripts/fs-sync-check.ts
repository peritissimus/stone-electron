/*
 * fs-sync-check.ts
 * Quick script to verify we can fetch and load data from the file system.
 * - Scans a workspace folder for .md files (no file creation)
 * - Ensures a workspace record exists (creates DB row only if missing)
 * - Syncs notebooks <- folders, notes <- files
 * - Prints per-folder note counts and a few titles
 *
 * Usage:
 *   pnpm fs:check --path "/absolute/path/to/NoteBook"
 *   (defaults to ~/NoteBook if not provided)
 */

import os from 'os';
import path from 'path';
import { getDatabaseManager } from '../src/main/database/DatabaseManager';
import { logger } from '../src/main/utils/logger';
import { Repositories } from '../src/main/repositories';
import { getFileSystemService } from '../src/main/services/FileSystemService';

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  const folderArg = parseArg('--path');
  const defaultPath = path.join(os.homedir(), 'NoteBook');
  const folderPath = folderArg || process.env.NOTEBOOK_PATH || defaultPath;

  console.info(`[fs-check] Using folder: ${folderPath}`);

  const db = getDatabaseManager();
  await db.initialize();

  const repos = new Repositories();
  const fsService = getFileSystemService();

  // 1) Pre-scan the folder (no mutations)
  const files = await fsService.scanFolder(folderPath, true);
  const structure = await fsService.getFolderStructure(folderPath);

  console.info(`[fs-check] Found ${files.length} markdown files before sync`);
  console.info(`[fs-check] Top-level folders:`);
  structure.filter((n) => n.type === 'folder').forEach((n) => console.info(`  - ${n.name}`));

  // 2) Ensure a workspace exists for this folder
  let workspace = await repos.workspace.findByFolderPath(folderPath);
  if (!workspace) {
    console.info(`[fs-check] Creating workspace record for: ${folderPath}`);
    workspace = await repos.workspace.create({
      name: path.basename(folderPath) || 'Notes',
      folderPath,
    });
  } else {
    console.info(`[fs-check] Using existing workspace: ${workspace.name} (${workspace.id})`);
  }

  // 3) Sync notebooks (folders) and notes (files)
  console.info('[fs-check] Syncing folders -> notebooks ...');
  const nbResult = await repos.notebook.syncWithWorkspaceFolders(workspace.id);
  console.info(
    `[fs-check] Notebook sync: created=${nbResult.created} updated=${nbResult.updated} errors=${nbResult.errors.length}`,
  );
  if (nbResult.errors.length) console.warn('[fs-check] Notebook sync errors:', nbResult.errors);

  console.info('[fs-check] Syncing files -> notes ...');
  const noteResult = await repos.note.syncWithFileSystem(workspace.id);
  console.info(
    `[fs-check] Note sync: created=${noteResult.created} updated=${noteResult.updated} deleted=${noteResult.deleted} errors=${noteResult.errors.length}`,
  );
  if (noteResult.errors.length) console.warn('[fs-check] Note sync errors:', noteResult.errors);

  // 4) Report per-folder note counts by reading back from DB
  const flatFolders = structure.filter((n) => n.type === 'folder');
  console.info('[fs-check] Per-folder counts:');
  for (const f of flatFolders) {
    const rel = f.relativePath;
    const notes = await repos.note.findByFolder(rel);
    console.info(
      `  - ${rel}: ${notes.length} notes${notes.length ? ` (e.g., ${notes[0].title})` : ''}`,
    );
  }

  console.info('[fs-check] Done');
}

main().catch((err) => {
  logger.error('Error:', err);
  process.exit(1);
});
