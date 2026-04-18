/**
 * Quick Capture API Hook - React hook for quick capture operations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { quickCaptureAPI } from '@renderer/api';
import { logger } from '@renderer/lib/logger';

export function useQuickCaptureAPI() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const appendToJournal = useCallback(
    async (text: string) => {
      if (!text.trim() || isSubmitting) return null;

      if (isMountedRef.current) {
        setIsSubmitting(true);
        setError(null);
      }

      try {
        const response = await quickCaptureAPI.appendToJournal(text.trim());
        if (response.success && response.data) {
          logger.info('[useQuickCaptureAPI] Appended to journal', {
            noteId: response.data.note?.id,
          });
          return response.data.note;
        } else {
          const errorMessage = response.error?.message || 'Failed to append to journal';
          logger.error('[useQuickCaptureAPI] Failed:', errorMessage);
          if (isMountedRef.current) setError(errorMessage);
          throw new Error(errorMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to append to journal';
        logger.error('[useQuickCaptureAPI] Error:', err);
        if (isMountedRef.current) setError(errorMessage);
        throw err instanceof Error ? err : new Error(errorMessage);
      } finally {
        if (isMountedRef.current) setIsSubmitting(false);
      }
    },
    [isSubmitting],
  );

  return {
    appendToJournal,
    isSubmitting,
    error,
  };
}
