/**
 * Shared IPC helper utilities for consistent responses and logging.
 */

import { logger } from '../../../shared';

export interface IPCErrorPayload {
  code: string;
  message: string;
}

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: IPCErrorPayload;
}

interface HandleIpcRequestOptions {
  loggerPrefix: string;
  defaultCode?: string;
  mapErrorCode?: (error: unknown) => string | undefined;
}

export async function handleIpcRequest<T>(
  fn: () => Promise<T>,
  { loggerPrefix, defaultCode = 'INTERNAL_ERROR', mapErrorCode }: HandleIpcRequestOptions,
): Promise<IPCResponse<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = mapErrorCode?.(error) ?? defaultCode;
    logger.error(`[IPC] ${loggerPrefix} error:`, { code, message });
    return { success: false, error: { code, message } };
  }
}
