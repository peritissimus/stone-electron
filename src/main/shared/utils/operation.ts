import { logger } from './logger';

export type AdapterLayer = 'in' | 'out';

/** Past this, an adapter call is worth surfacing even when it succeeded. */
const SLOW_OPERATION_MS = 200;

export interface HandleRequestOptions {
  layer: AdapterLayer;
  adapter: string;
  operation: string;
  context?: Record<string, unknown>;
}

export async function handleRequest<T>(
  fn: () => Promise<T>,
  { layer, adapter, operation, context = {} }: HandleRequestOptions,
): Promise<T> {
  const fallbackChannel = `${layer}:${adapter}.${operation}`;
  const channel =
    typeof context.channel === 'string' && context.channel.trim() ? context.channel : fallbackChannel;

  return await logger.withContext(channel, async () => {
    const startedAt = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - startedAt;
      // A successful adapter call is not news — three of these per HTTP request
      // buried anything worth reading. Only a slow one earns attention.
      logger[durationMs >= SLOW_OPERATION_MS ? 'warn' : 'debug']({
        event: 'request',
        layer,
        adapter,
        operation,
        success: true,
        durationMs,
        ...context,
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      logger.error({
        event: 'request',
        layer,
        adapter,
        operation,
        success: false,
        durationMs,
        errorType: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });
      throw error;
    }
  });
}

// Convenience wrapper for OUT adapters (repositories, services, storage)
export interface HandleOperationOptions {
  adapter: string;
  operation: string;
  context?: Record<string, unknown>;
}

export async function handleOperation<T>(
  fn: () => Promise<T>,
  { adapter, operation, context = {} }: HandleOperationOptions,
): Promise<T> {
  return handleRequest(fn, { layer: 'out', adapter, operation, context });
}
