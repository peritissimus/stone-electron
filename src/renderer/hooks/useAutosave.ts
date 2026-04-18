/**
 * Autosave Hook - Generic debounced save orchestrator
 *
 * Provides saveDebounced, saveImmediate, cancel, and pending/saving
 * introspection so callers don't have to manage their own timeouts.
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger } from '@renderer/utils/logger';

interface UseAutosaveOptions<T> {
  saveFn: (data: T) => Promise<void>;
  delay?: number;
  onError?: (error: unknown) => void;
}

export function useAutosave<T = Record<string, unknown>>({
  saveFn,
  delay = 500,
  onError,
}: UseAutosaveOptions<T>) {
  const timeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);

  const saveDebounced = useCallback(
    (data: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(async () => {
        timeoutRef.current = null;
        isSavingRef.current = true;
        try {
          await saveFn(data);
        } catch (error) {
          logger.error('Autosave failed:', error);
          onError?.(error);
        } finally {
          isSavingRef.current = false;
        }
      }, delay);
    },
    [saveFn, delay, onError],
  );

  const saveImmediate = useCallback(
    async (data: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      isSavingRef.current = true;
      try {
        await saveFn(data);
      } catch (error) {
        logger.error('Immediate save failed:', error);
        onError?.(error);
      } finally {
        isSavingRef.current = false;
      }
    },
    [saveFn, onError],
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    saveDebounced,
    saveImmediate,
    cancel,
    isPending: () => timeoutRef.current !== null,
    isSaving: () => isSavingRef.current,
  };
}
