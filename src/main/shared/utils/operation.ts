import { logger } from './logger';

export interface HandleOperationOptions {
  adapter: string;
  operation: string;
  context?: Record<string, unknown>;
}

export async function handleOperation<T>(
  fn: () => Promise<T>,
  { adapter, operation, context = {} }: HandleOperationOptions,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    logger.info('[Operation]', {
      event: 'operation',
      adapter,
      operation,
      success: true,
      durationMs,
      ...context,
    });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('[Operation]', {
      event: 'operation',
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
