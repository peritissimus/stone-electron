/**
 * Run a JavaScript-for-Automation (JXA) script via `osascript -l JavaScript`
 * and parse its stdout as JSON. Failures retain enough information for the
 * renderer to distinguish denied access from an empty Calendar or Mail inbox.
 */

import { execFile } from 'node:child_process';
import { logger } from '../../../shared/utils';

export type JxaFailureReason = 'denied' | 'unavailable' | 'timeout' | 'error';

export type JxaResult<T> =
  { ok: true; data: T } | { ok: false; reason: JxaFailureReason; message: string };

interface JxaRequestOptions {
  target: 'Calendar' | 'Mail';
  timeoutMs: number;
}

function classifyFailure(message: string, killed: boolean): JxaFailureReason {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('-1743') ||
    normalized.includes('not authorized to send apple events') ||
    normalized.includes('not permitted to send apple events') ||
    normalized.includes('automation permission')
  ) {
    return 'denied';
  }
  if (killed || normalized.includes('timed out')) return 'timeout';
  return 'error';
}

export async function runJxa<T>(
  script: string,
  { target, timeoutMs }: JxaRequestOptions,
): Promise<JxaResult<T>> {
  if (process.platform !== 'darwin') {
    return { ok: false, reason: 'unavailable', message: 'Available on macOS only.' };
  }
  return new Promise<JxaResult<T>>((resolve) => {
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          const reason = classifyFailure(error.message, Boolean(error.killed));
          logger.warn('[JXA] request failed', {
            target,
            reason,
            code: error.code ?? null,
            killed: Boolean(error.killed),
          });
          resolve({
            ok: false,
            reason,
            message:
              reason === 'denied'
                ? 'Access is blocked in macOS Automation settings.'
                : reason === 'timeout'
                  ? 'The application did not respond in time.'
                  : 'Could not read from the application.',
          });
          return;
        }
        const out = stdout.trim();
        if (!out) {
          resolve({ ok: false, reason: 'error', message: 'The application returned no data.' });
          return;
        }
        try {
          resolve({ ok: true, data: JSON.parse(out) as T });
        } catch {
          logger.warn('[JXA] invalid response', { target });
          resolve({
            ok: false,
            reason: 'error',
            message: 'The application returned invalid data.',
          });
        }
      },
    );
  });
}
