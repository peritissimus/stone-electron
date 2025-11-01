/**
 * Workspace API Hook - sync and workspace operations
 */

import { useCallback } from 'react';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';

export function useWorkspaceAPI() {
  const syncWorkspace = useCallback(async (workspaceId?: string) => {
    const response = await window.electron.invoke<{
      workspaceId: string;
      notebooks: { created: number; updated: number; errors: string[] };
      notes: { created: number; updated: number; deleted: number; errors: string[] };
    }>(WORKSPACE_CHANNELS.SYNC, workspaceId ? { workspaceId } : {});

    return response;
  }, []);

  return { syncWorkspace };
}
