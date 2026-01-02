/**
 * IPC Utilities - Centralized IPC invocation and response handling
 *
 * This module provides type-safe wrappers for Electron IPC communication,
 * reducing boilerplate across API hooks.
 */

import { IpcResponse } from '@shared/types';
import { logger } from '@renderer/utils/logger';

/**
 * Result of handling an IPC response
 */
export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Options for IPC invocation
 */
export interface InvokeOptions {
  /** Log prefix for debugging */
  logPrefix?: string;
  /** Whether to log the request/response */
  debug?: boolean;
}

/**
 * Handle an IPC response with consistent error extraction
 *
 * @param response - The IPC response from electron.invoke
 * @param fallbackError - Error message to use if none is provided
 * @returns Normalized result with success flag and data or error
 *
 * @example
 * const response = await window.electron.invoke<Note>(NOTE_CHANNELS.GET, { id });
 * const result = handleIpcResponse(response, 'Failed to load note');
 * if (result.success) {
 *   // result.data is Note
 * } else {
 *   // result.error is string
 * }
 */
export function handleIpcResponse<T>(
  response: IpcResponse<T>,
  fallbackError: string
): IpcResult<T> {
  if (response.success && response.data !== undefined) {
    return { success: true, data: response.data };
  }
  return {
    success: false,
    error: response.error?.message || fallbackError
  };
}

/**
 * Handle an IPC response that only returns success/failure (no data)
 *
 * @param response - The IPC response from electron.invoke
 * @param fallbackError - Error message to use if none is provided
 * @returns Normalized result with success flag and optional error
 */
export function handleIpcVoidResponse(
  response: IpcResponse<unknown>,
  fallbackError: string
): { success: boolean; error?: string } {
  if (response.success) {
    return { success: true };
  }
  return {
    success: false,
    error: response.error?.message || fallbackError
  };
}

/**
 * Type-safe IPC invocation wrapper with optional logging
 *
 * @param channel - The IPC channel to invoke
 * @param params - Parameters to pass to the handler
 * @param options - Optional configuration for logging
 * @returns Promise resolving to the IPC response
 *
 * @example
 * const response = await invokeIpc<Note>(NOTE_CHANNELS.GET, { id }, {
 *   logPrefix: '[NoteAPI.loadNote]',
 *   debug: true
 * });
 */
export async function invokeIpc<T>(
  channel: string,
  params?: unknown,
  options?: InvokeOptions
): Promise<IpcResponse<T>> {
  const { logPrefix, debug } = options || {};

  if (debug && logPrefix) {
    logger.info(`${logPrefix} invoking ${channel}`, params);
  }

  const response = await window.electron.invoke<T>(channel, params);

  if (debug && logPrefix) {
    logger.info(`${logPrefix} response`, { success: response.success });
  }

  return response;
}

/**
 * Invoke IPC and handle response in one call
 *
 * @param channel - The IPC channel to invoke
 * @param params - Parameters to pass to the handler
 * @param fallbackError - Error message if the call fails
 * @param options - Optional configuration for logging
 * @returns Normalized result with success flag and data or error
 *
 * @example
 * const result = await invokeAndHandle<Note>(
 *   NOTE_CHANNELS.GET,
 *   { id },
 *   'Failed to load note'
 * );
 * if (result.success) {
 *   updateNote(result.data);
 * } else {
 *   setError(result.error);
 * }
 */
export async function invokeAndHandle<T>(
  channel: string,
  params: unknown,
  fallbackError: string,
  options?: InvokeOptions
): Promise<IpcResult<T>> {
  try {
    const response = await invokeIpc<T>(channel, params, options);
    return handleIpcResponse(response, fallbackError);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : fallbackError;
    if (options?.logPrefix) {
      logger.error(`${options.logPrefix} error`, error);
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Invoke IPC for void operations (delete, toggle, etc.)
 *
 * @param channel - The IPC channel to invoke
 * @param params - Parameters to pass to the handler
 * @param fallbackError - Error message if the call fails
 * @param options - Optional configuration for logging
 * @returns Object with success flag and optional error
 */
export async function invokeAndHandleVoid(
  channel: string,
  params: unknown,
  fallbackError: string,
  options?: InvokeOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await invokeIpc<unknown>(channel, params, options);
    return handleIpcVoidResponse(response, fallbackError);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : fallbackError;
    if (options?.logPrefix) {
      logger.error(`${options.logPrefix} error`, error);
    }
    return { success: false, error: errorMessage };
  }
}
