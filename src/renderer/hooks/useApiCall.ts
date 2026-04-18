/**
 * Generic API Call Hook - Reduces boilerplate in API hooks
 *
 * Provides reusable patterns for common IPC operations with
 * consistent loading/error state management.
 */

import { useCallback } from 'react';
import { invokeIpc, handleIpcResponse, IpcResult } from '@renderer/lib/ipc';
import { logger } from '@renderer/lib/logger';

/**
 * Store actions that API hooks typically need
 */
interface StoreActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Options for API call creation
 */
interface ApiCallOptions {
  /** Whether to set loading state during the call */
  showLoading?: boolean;
  /** Log prefix for debugging */
  logPrefix?: string;
}

/**
 * Create a wrapped API call function with loading/error handling
 *
 * @param store - Object containing setLoading and setError actions
 * @returns Factory function for creating API calls
 *
 * @example
 * const { createApiCall } = useApiCall({ setLoading, setError });
 *
 * const loadNotes = createApiCall(
 *   async (filters) => {
 *     const response = await invokeIpc<{ notes: Note[] }>(NOTE_CHANNELS.GET_ALL, filters);
 *     return handleIpcResponse(response, 'Failed to load notes');
 *   },
 *   (result) => setNotes(result.data.notes),
 *   { showLoading: true, logPrefix: '[NoteAPI.loadNotes]' }
 * );
 */
export function useApiCall(store: StoreActions) {
  const { setLoading, setError } = store;

  /**
   * Create a wrapped API call with automatic loading/error handling
   *
   * @param fn - The async function to execute
   * @param onSuccess - Optional callback on success, receives the data
   * @param options - Configuration options
   */
  const createCall = useCallback(
    <TParams, TResult, TReturn = TResult>(
      fn: (params: TParams) => Promise<IpcResult<TResult>>,
      onSuccess?: (data: TResult, params: TParams) => TReturn | void,
      options: ApiCallOptions = {},
    ) => {
      const { showLoading = false, logPrefix } = options;

      return async (params: TParams): Promise<TReturn | null> => {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);

        try {
          if (logPrefix) {
            logger.info(`${logPrefix} called`, params);
          }

          const result = await fn(params);

          if (result.success) {
            if (logPrefix) {
              logger.info(`${logPrefix} success`);
            }
            if (onSuccess) {
              const returnValue = onSuccess(result.data, params);
              return returnValue !== undefined ? returnValue : (result.data as unknown as TReturn);
            }
            return result.data as unknown as TReturn;
          } else {
            if (logPrefix) {
              logger.error(`${logPrefix} failed`, result.error);
            }
            setError(result.error);
            return null;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'An unexpected error occurred';
          if (logPrefix) {
            logger.error(`${logPrefix} exception`, error);
          }
          setError(message);
          return null;
        } finally {
          if (showLoading) {
            setLoading(false);
          }
        }
      };
    },
    [setLoading, setError],
  );

  /**
   * Create a void API call (for operations that don't return data)
   */
  const createVoidCall = useCallback(
    <TParams>(
      fn: (params: TParams) => Promise<{ success: boolean; error?: string }>,
      onSuccess?: (params: TParams) => void,
      options: ApiCallOptions = {},
    ) => {
      const { showLoading = false, logPrefix } = options;

      return async (params: TParams): Promise<boolean> => {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);

        try {
          if (logPrefix) {
            logger.info(`${logPrefix} called`, params);
          }

          const result = await fn(params);

          if (result.success) {
            if (logPrefix) {
              logger.info(`${logPrefix} success`);
            }
            if (onSuccess) {
              onSuccess(params);
            }
            return true;
          } else {
            if (logPrefix) {
              logger.error(`${logPrefix} failed`, result.error);
            }
            setError(result.error || 'Operation failed');
            return false;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'An unexpected error occurred';
          if (logPrefix) {
            logger.error(`${logPrefix} exception`, error);
          }
          setError(message);
          return false;
        } finally {
          if (showLoading) {
            setLoading(false);
          }
        }
      };
    },
    [setLoading, setError],
  );

  return {
    createCall,
    createVoidCall,
  };
}

/**
 * Helper to create a simple IPC call handler
 */
export function createIpcHandler<TParams, TResult>(
  channel: string,
  fallbackError: string,
  logPrefix?: string,
) {
  return async (params: TParams): Promise<IpcResult<TResult>> => {
    try {
      const response = await invokeIpc<TResult>(channel, params, { logPrefix, debug: !!logPrefix });
      return handleIpcResponse(response, fallbackError);
    } catch (error) {
      const message = error instanceof Error ? error.message : fallbackError;
      if (logPrefix) {
        logger.error(`${logPrefix} exception`, error);
      }
      return { success: false, error: message };
    }
  };
}
