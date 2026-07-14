/**
 * OpenTelemetry bootstrap — DEV ONLY.
 *
 * This module is loaded exclusively via a dev-gated dynamic import (see
 * index.ts), and every @opentelemetry/* SDK package here is a devDependency,
 * so none of this ships to or runs in a production build.
 *
 * Coverage = auto-instrumentation (monkey-patching) of the HTTP/fetch layer:
 * the whisper-server inference calls, AI SDK requests, and model downloads all
 * go through Node's built-in undici/http and get spans for free. App-specific
 * boundaries (jobs, IPC) are covered by manual spans (OtelJobTracer, etc.).
 *
 * Requires a local OTLP collector / Tempo at OTEL_EXPORTER_OTLP_ENDPOINT
 * (default http://localhost:4318). If nothing is listening, the exporter just
 * fails to send — it never breaks the app.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { logger } from '../../shared/utils';

let sdk: NodeSDK | null = null;

/** Start tracing. Idempotent; safe to call once at startup. */
export function startTelemetry(): void {
  if (sdk) return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  sdk = new NodeSDK({
    serviceName: 'stone-main',
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [new UndiciInstrumentation(), new HttpInstrumentation()],
  });
  sdk.start();
  logger.info(`[otel] tracing started (dev) → ${endpoint}`);
}

/** Flush + shut down on quit. Best-effort. */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  const current = sdk;
  sdk = null;
  try {
    await current.shutdown();
  } catch (err) {
    logger.warn('[otel] shutdown failed:', err);
  }
}
