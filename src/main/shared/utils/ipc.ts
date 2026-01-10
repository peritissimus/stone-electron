import { logger } from './logger';

export interface IPCErrorPayload {
  code: string;
  message: string;
}

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: IPCErrorPayload;
}

export interface HandleIpcRequestOptions {
  loggerPrefix: string;
  defaultCode?: string;
  errorMap?: Record<string, string>;
  mapErrorCode?: (error: unknown) => string | undefined;
  context?: Record<string, unknown>;
}

const resolveErrorCode = (
  error: unknown,
  defaultCode: string,
  errorMap?: Record<string, string>,
  mapErrorCode?: (error: unknown) => string | undefined,
): string => {
  if (mapErrorCode) {
    const mapped = mapErrorCode(error);
    if (mapped) return mapped;
  }
  if (error instanceof Error && error.name && errorMap?.[error.name]) {
    return errorMap[error.name];
  }
  return defaultCode;
};

export async function handleIpcRequest<T>(
  fn: () => Promise<T>,
  {
    loggerPrefix,
    defaultCode = 'INTERNAL_ERROR',
    errorMap,
    mapErrorCode,
    context = {},
  }: HandleIpcRequestOptions,
): Promise<IPCResponse<T>> {
  const startedAt = Date.now();
  try {
    const data = await fn();
    const durationMs = Date.now() - startedAt;
    logger.info({
      event: 'request',
      layer: 'in',
      adapter: loggerPrefix,
      operation: context.channel ?? 'unknown',
      success: true,
      durationMs,
      ...context,
    });
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = resolveErrorCode(error, defaultCode, errorMap, mapErrorCode);
    const durationMs = Date.now() - startedAt;
    logger.error({
      event: 'request',
      layer: 'in',
      adapter: loggerPrefix,
      operation: context.channel ?? 'unknown',
      success: false,
      durationMs,
      code,
      message,
      errorType: error instanceof Error ? error.name : 'Unknown',
      ...context,
    });
    return { success: false, error: { code, message } };
  }
}
