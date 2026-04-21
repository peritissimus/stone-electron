import { useCallback } from 'react';
import { toast } from 'sonner';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTree } from '@renderer/hooks/useFileTree';
import { logger } from '@renderer/lib/logger';

export function useWorkspaceSync() {
  const { syncWorkspace, loadWorkspaces } = useWorkspaceAPI();
  const { loadFileTree } = useFileTreeAPI();
  const { loadNotes } = useNoteAPI();
  const { activeFolder } = useFileTree();

  return useCallback(async () => {
    try {
      const res = await syncWorkspace();
      if (res.success) {
        logger.info('Sync complete', res.data);
        await loadWorkspaces();
        await loadFileTree();
        if (activeFolder) {
          await loadNotes({ folderPath: activeFolder });
        } else {
          await loadNotes();
        }
      } else {
        logger.error('Sync failed', res.error);
        toast.error(res.error?.message || 'Sync failed');
      }
    } catch (e) {
      logger.error('Sync error', e);
      toast.error('Sync failed');
    }
  }, [syncWorkspace, loadWorkspaces, loadFileTree, loadNotes, activeFolder]);
}
