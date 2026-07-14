/**
 * IJobTracer — observability port for background work.
 *
 * Each job execution opens a span; the adapter decides where it goes. Today a
 * LoggerJobTracer emits structured span events through the existing logger so
 * job latency / outcome / retry counts are measurable. The intended drop-in
 * replacement is an OpenTelemetry adapter that exports spans to Tempo — same
 * port, no caller changes.
 */

export type JobSpanStatus = 'ok' | 'error';

export type JobSpanAttributes = Record<string, string | number | boolean>;

export interface JobSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  recordError(error: unknown): void;
  /** Close the span, recording its outcome and duration. */
  end(status: JobSpanStatus): void;
}

export interface IJobTracer {
  startSpan(name: string, attributes?: JobSpanAttributes): JobSpan;
}
