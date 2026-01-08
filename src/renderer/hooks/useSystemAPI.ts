/**
 * System API Hook - React hook for system operations
 */

import { useCallback, useState } from 'react';
import { systemAPI } from '@renderer/api';
import { logger } from '@renderer/utils/logger';

interface UseSystemAPIState {
  fonts: string[];
  loading: boolean;
  error: string | null;
}

export function useSystemAPI() {
  const [state, setState] = useState<UseSystemAPIState>({
    fonts: [],
    loading: false,
    error: null,
  });

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const getFonts = useCallback(async (): Promise<string[]> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await systemAPI.getFonts();
      if (response.success && response.data) {
        setState((s) => ({ ...s, fonts: response.data!.fonts, loading: false }));
        return response.data.fonts;
      } else {
        setError(response.error?.message || 'Failed to get system fonts');
        setState((s) => ({ ...s, loading: false }));
        return [];
      }
    } catch (err) {
      logger.error('[useSystemAPI.getFonts] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get system fonts');
      setState((s) => ({ ...s, loading: false }));
      return [];
    }
  }, [setError]);

  return {
    // State
    fonts: state.fonts,
    loading: state.loading,
    error: state.error,
    // Actions
    getFonts,
    clearError: () => setError(null),
  };
}
