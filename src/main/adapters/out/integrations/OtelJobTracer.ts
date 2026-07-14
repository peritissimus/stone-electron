/**
 * OtelJobTracer — IJobTracer backed by real OpenTelemetry spans.
 *
 * Uses only @opentelemetry/api, which no-ops unless an SDK is registered — so
 * this is harmless if instantiated without telemetry running. In practice the
 * container only wires it in dev (where the OTel SDK bootstrap is active);
 * production uses LoggerJobTracer.
 */

import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { IJobTracer, JobSpan, JobSpanAttributes, JobSpanStatus } from '../../../domain';

const tracer = trace.getTracer('stone-jobs');

export class OtelJobTracer implements IJobTracer {
  startSpan(name: string, attributes: JobSpanAttributes = {}): JobSpan {
    const span = tracer.startSpan(name, { attributes });
    return {
      setAttribute(key: string, value: string | number | boolean): void {
        span.setAttribute(key, value);
      },
      recordError(error: unknown): void {
        span.recordException(
          error instanceof Error ? error : { name: 'Error', message: String(error) },
        );
      },
      end(status: JobSpanStatus): void {
        span.setStatus({
          code: status === 'error' ? SpanStatusCode.ERROR : SpanStatusCode.OK,
        });
        span.end();
      },
    };
  }
}
