import { useCallback } from 'react';
import { scratchAPI } from '@renderer/api';

export function useScratchAPI() {
  const pickScratchFile = useCallback(async (): Promise<string | null> => {
    const response = await scratchAPI.pick();
    return response.success && response.data?.path ? response.data.path : null;
  }, []);

  return { pickScratchFile };
}
