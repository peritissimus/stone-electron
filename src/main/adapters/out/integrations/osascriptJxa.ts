/**
 * Run a JavaScript-for-Automation (JXA) script via `osascript -l JavaScript`
 * and parse its stdout as JSON. macOS-only. Returns null on any failure
 * (non-darwin, permission denied, timeout, non-JSON output) so callers can
 * degrade to an empty result.
 */

import { execFile } from 'node:child_process';
import { logger } from '../../../shared/utils';

export async function runJxa<T>(script: string, timeoutMs = 8000): Promise<T | null> {
  if (process.platform !== 'darwin') return null;
  return new Promise<T | null>((resolve) => {
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          logger.warn(`[JXA] script failed: ${error.message}`);
          resolve(null);
          return;
        }
        const out = stdout.trim();
        if (!out) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(out) as T);
        } catch {
          logger.warn('[JXA] non-JSON output');
          resolve(null);
        }
      },
    );
  });
}
