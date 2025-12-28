/**
 * IPC Utilities - Error handling and response formatting
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { logger } from '../utils/logger'

// Enable profiling via env var: STONE_PROFILE=50 means log calls > 50ms
const PROFILE_THRESHOLD = process.env.STONE_PROFILE ? parseInt(process.env.STONE_PROFILE, 10) : null

/**
 * IPC Error class
 */
export class IpcError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'IpcError'
  }
}

/**
 * Wrap IPC handler with error handling
 */
export function handleIpcError(error: unknown): never {
  if (error instanceof IpcError) {
    throw error
  }

  if (error instanceof Error) {
    throw new IpcError('INTERNAL_ERROR', error.message, { stack: error.stack })
  }

  throw new IpcError('UNKNOWN_ERROR', String(error))
}

/**
 * Create a success response
 */
export function success<T>(data: T) {
  return {
    success: true,
    data,
  }
}

/**
 * Create an error response
 */
export function error(code: string, message: string, details?: unknown) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: Math.floor(Date.now() / 1000),
    },
  }
}

/**
 * Wrap an async handler with error handling
 */
export function createHandler<TRequest = unknown, TResponse = unknown>(
  handler: (event: IpcMainInvokeEvent, request: TRequest) => Promise<TResponse> | TResponse
) {
  return async (event: IpcMainInvokeEvent, request: TRequest) => {
    try {
      const result = await handler(event, request)
      return success(result)
    } catch (err) {
      if (err instanceof IpcError) {
        return error(err.code, err.message, err.details)
      }

      if (err instanceof Error) {
        return error('INTERNAL_ERROR', err.message, { stack: err.stack })
      }

      return error('UNKNOWN_ERROR', String(err))
    }
  }
}

/**
 * Register an IPC handler with automatic profiling
 *
 * Enable profiling by setting env var:
 *   STONE_PROFILE=50   - Log calls taking > 50ms
 *   STONE_PROFILE=100  - Log calls taking > 100ms
 */
export function registerHandler<TRequest = unknown, TResponse = unknown>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, request: TRequest) => Promise<TResponse> | TResponse
) {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, request: TRequest) => {
    const start = PROFILE_THRESHOLD !== null ? performance.now() : 0

    try {
      const result = await handler(event, request)

      if (PROFILE_THRESHOLD !== null) {
        const duration = performance.now() - start
        if (duration > PROFILE_THRESHOLD) {
          logger.warn(`[SLOW] ${channel} ${duration.toFixed(0)}ms`)
        }
      }

      return success(result)
    } catch (err) {
      if (PROFILE_THRESHOLD !== null) {
        const duration = performance.now() - start
        logger.error(`[FAIL] ${channel} ${duration.toFixed(0)}ms`)
      }

      if (err instanceof IpcError) {
        return error(err.code, err.message, err.details)
      }

      if (err instanceof Error) {
        return error('INTERNAL_ERROR', err.message, { stack: err.stack })
      }

      return error('UNKNOWN_ERROR', String(err))
    }
  })
}
