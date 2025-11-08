/*
 * fs-scan-only.ts
 * Node-only script to verify we can fetch data from the file system.
 * - Recursively scans a folder for .md files (no DB, no Electron needed)
 * - Prints total files and per-folder counts with a few examples
 *
 * Usage:
 *   pnpm fs:scan --path "/absolute/path/to/NoteBook"
 *   (defaults to ~/NoteBook)
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '../src/main/utils/logger';

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

async function scan(dir: string, base: string, acc: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await scan(full, base, acc);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      acc.push(path.relative(base, full));
    }
  }
  return acc;
}

async function main() {
  const folderArg = parseArg('--path');
  const defaultPath = path.join(os.homedir(), 'NoteBook');
  const folderPath = folderArg || process.env.NOTEBOOK_PATH || defaultPath;

  console.info(`[fs-scan] Scanning: ${folderPath}`);
  const mdFiles = await scan(folderPath, folderPath);
  console.info(`[fs-scan] Total markdown files: ${mdFiles.length}`);

  const byFolder = new Map<string, string[]>();
  for (const rel of mdFiles) {
    const folder = path.dirname(rel);
    const arr = byFolder.get(folder) || [];
    arr.push(rel);
    byFolder.set(folder, arr);
  }

  const folders = Array.from(byFolder.keys()).sort();
  console.info('[fs-scan] Per-folder:');
  for (const f of folders) {
    const list = byFolder.get(f) || [];
    const sample = list
      .slice(0, 2)
      .map((p) => path.basename(p))
      .join(', ');
    console.info(
      `  - ${f === '.' ? '(root)' : f}: ${list.length}${sample ? ` (e.g., ${sample})` : ''}`,
    );
  }

  console.info('[fs-scan] Done');
}

main().catch((err) => {
  logger.error('Error:', err);
  process.exit(1);
});
