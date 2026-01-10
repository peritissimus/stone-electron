/**
 * Quick Capture API Hook - React hook for quick capture operations
 */

import { useCallback, useState } from 'react';
import { quickCaptureAPI } from '@renderer/api';
import { logger } from '@renderer/utils/logger';

export function useQuickCaptureAPI() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appendToJournal = useCallback(
    async (text: string) => {
      if (!text.trim() || isSubmitting) return null;

      setIsSubmitting(true);
      setError(null);

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
          setError(errorMessage);
          return null;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to append to journal';
        logger.error('[useQuickCaptureAPI] Error:', err);
        setError(errorMessage);
        return null;
      } finally {
        setIsSubmitting(false);
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
