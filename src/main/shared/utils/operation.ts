import { logger } from './logger';

export type AdapterLayer = 'in' | 'out';

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
  const startedAt = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    logger.info({
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
