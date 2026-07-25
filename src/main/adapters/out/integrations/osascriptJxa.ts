/**
 * Run a JavaScript-for-Automation (JXA) script via `osascript -l JavaScript`
 * and parse its stdout as JSON. Failures retain enough information for the
 * renderer to distinguish denied access from an empty Calendar or Mail inbox.
 */

import { Effect } from 'effect';
import { logger } from '../../../shared/utils';
import {
  commandTimeout,
  runCommand,
  type CommandRunner,
} from './commandRunner';

export type JxaFailureReason = 'denied' | 'unavailable' | 'timeout' | 'error';

export type JxaResult<T> =
  { ok: true; data: T } | { ok: false; reason: JxaFailureReason; message: string };

interface JxaRequestOptions {
  target: 'Calendar' | 'Mail';
  timeoutMs: number;
  signal?: AbortSignal;
  commandRunner?: CommandRunner;
  runPromise?: <A, E>(
    effect: Effect.Effect<A, E>,
    options?: { signal?: AbortSignal },
  ) => Promise<A>;
}

function classifyFailure(message: string, timedOut: boolean): JxaFailureReason {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('-1743') ||
    normalized.includes('not authorized to send apple events') ||
    normalized.includes('not permitted to send apple events') ||
    normalized.includes('automation permission')
  ) {
    return 'denied';
  }
  if (timedOut || normalized.includes('timed out')) return 'timeout';
  return 'error';
}

export async function runJxa<T>(script: string, options: JxaRequestOptions): Promise<JxaResult<T>> {
  if (!options.runPromise) throw new Error('JXA Promise facade requires an Effect runtime');
  return options.runPromise(runJxaEffect<T>(script, options), { signal: options.signal });
}

export function runJxaEffect<T>(
  script: string,
  options: JxaRequestOptions,
): Effect.Effect<JxaResult<T>> {
  const { target, timeoutMs } = options;
  if (process.platform !== 'darwin') {
    return Effect.succeed({
      ok: false as const,
      reason: 'unavailable' as const,
      message: 'Available on macOS only.',
    });
  }
  const commandRunner = options.commandRunner ?? runCommand;
  return commandRunner(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { maxBuffer: 4 * 1024 * 1024 },
    ).pipe(
      Effect.timeoutFail({
        duration: timeoutMs,
        onTimeout: () => commandTimeout(`${target} command timed out`),
      }),
      Effect.match({
        onFailure: (error): JxaResult<T> => {
          const timedOut = error.name === 'CommandTimeoutError';
          const reason = classifyFailure(error.message, timedOut);
          logger.warn('[JXA] request failed', {
            target,
            reason,
            code: 'code' in error ? (error as Error & { code?: unknown }).code ?? null : null,
            killed: timedOut,
          });
          return {
            ok: false,
            reason,
            message:
              reason === 'denied'
                ? 'Access is blocked in macOS Automation settings.'
                : reason === 'timeout'
                  ? 'The application did not respond in time.'
                  : 'Could not read from the application.',
          };
        },
        onSuccess: ({ stdout }): JxaResult<T> => {
        const out = stdout.trim();
        if (!out) {
          return { ok: false, reason: 'error', message: 'The application returned no data.' };
        }
        try {
          return { ok: true, data: JSON.parse(out) as T };
        } catch {
          logger.warn('[JXA] invalid response', { target });
          return {
            ok: false,
            reason: 'error',
            message: 'The application returned invalid data.',
          };
        }
        },
      }),
    );
}
