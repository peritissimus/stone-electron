import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Chromium re-creates these under userData on demand; copying them during a
 * one-time migration is wasteful (often hundreds of MB) and can carry stale
 * GPU/code caches into the new home. Skip them — only durable app data moves.
 */
const VOLATILE_ENTRIES = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'blob_storage',
  'Crashpad',
  'Service Worker',
  'Shared Dictionary',
]);

/**
 * Pin Electron's app-data dir to ~/.config/stone on every platform so
 * config.json, the SQLite DB, encrypted provider keys and logs share one
 * predictable location. (macOS otherwise defaults to
 * ~/Library/Application Support/stone, Windows to %APPDATA%.)
 *
 * MUST be called before anything reads app.getPath('userData') — i.e. before
 * the DI container, the database manager, the repositories, or the first
 * file-log write. The logger resolves its path lazily, so calling this at the
 * top of the main module body (before `whenReady`) is early enough.
 *
 * One-time migration: if the target doesn't exist yet but the old default dir
 * does, copy durable data across so nothing is lost on upgrade.
 */
export function relocateUserData(): string {
  const target = path.join(os.homedir(), '.config', 'stone');
  const previous = app.getPath('userData'); // default home, before the override

  try {
    const samePath = path.resolve(previous) === path.resolve(target);
    if (!samePath && !fs.existsSync(target) && fs.existsSync(previous)) {
      fs.cpSync(previous, target, {
        recursive: true,
        filter: (src) => !VOLATILE_ENTRIES.has(path.basename(src)),
      });
    }
  } catch {
    // Best-effort: a fresh target dir is still fully usable (defaults seed).
  }

  app.setPath('userData', target);
  return target;
}
