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

/**
 * Error-name → IPC error-code mappings every IPC adapter wants. Adapters
 * spread this into their own `errorMap` to add slice-specific entries
 * (e.g. NoteNotFoundError → NOTE_NOT_FOUND).
 *
 * Currently just surfaces Zod parse failures — request-payload validation
 * is uniform across adapters, so its error code should be too.
 */
export const COMMON_IPC_ERROR_MAP: Readonly<Record<string, string>> = Object.freeze({
  ZodError: 'VALIDATION_ERROR',
});

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
  const operation =
    typeof context.channel === 'string' && context.channel.trim()
      ? context.channel
      : `${loggerPrefix}:unknown`;
  const traceData: Record<string, unknown> = {
    event: 'request',
    layer: 'in',
    adapter: loggerPrefix,
    operation,
    ...context,
  };

  try {
    const data = await logger.trace(operation, async () => {
      try {
        return await fn();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const code = resolveErrorCode(error, defaultCode, errorMap, mapErrorCode);

        const wrapped = new Error(message);
        wrapped.name = error instanceof Error ? error.name : 'UnknownError';
        if (error instanceof Error && error.stack) wrapped.stack = error.stack;
        (wrapped as { code?: string }).code = code;
        (wrapped as { cause?: unknown }).cause = error;

        throw wrapped;
      }
    }, traceData);

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code =
      (error as { code?: string } | null)?.code ??
      resolveErrorCode(error, defaultCode, errorMap, mapErrorCode);

    return { success: false, error: { code, message } };
  }
}
