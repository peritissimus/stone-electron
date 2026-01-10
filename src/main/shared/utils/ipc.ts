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
  { loggerPrefix, defaultCode = 'INTERNAL_ERROR', errorMap, mapErrorCode }: HandleIpcRequestOptions,
): Promise<IPCResponse<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = resolveErrorCode(error, defaultCode, errorMap, mapErrorCode);
    logger.error(`[IPC] ${loggerPrefix} error:`, { code, message });
    return { success: false, error: { code, message } };
  }
}
