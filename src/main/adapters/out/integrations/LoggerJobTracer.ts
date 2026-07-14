/**
 * LoggerJobTracer — IJobTracer implementation that emits structured span
 * events through the app logger. This makes background-job latency, outcome,
 * and retry counts measurable today (same structured shape as the IPC
 * `event: 'request'` logs) without pulling in the OpenTelemetry SDK.
 *
 * The intended upgrade is an `OtelJobTracer` that exports real spans to Tempo —
 * it implements the same IJobTracer port, so the JobRunner doesn't change.
 */

import type { IJobTracer, JobSpan, JobSpanAttributes, JobSpanStatus } from '../../../domain';
import { logger } from '../../../shared/utils';

export class LoggerJobTracer implements IJobTracer {
  startSpan(name: string, attributes: JobSpanAttributes = {}): JobSpan {
    const startedAt = Date.now();
    const attrs: Record<string, unknown> = { ...attributes };
    let recordedError: unknown = null;

    return {
      setAttribute(key: string, value: string | number | boolean): void {
        attrs[key] = value;
      },
      recordError(error: unknown): void {
        recordedError = error;
      },
      end(status: JobSpanStatus): void {
        const event = {
          event: 'job',
          name,
          status,
          duration_ms: Date.now() - startedAt,
          ...attrs,
        };
        if (status === 'error') {
          logger.warn(`[job] ${name} failed`, {
            ...event,
            error: recordedError instanceof Error ? recordedError.message : recordedError,
          });
        } else {
          logger.debug(`[job] ${name} ok`, event);
        }
      },
    };
  }
}
