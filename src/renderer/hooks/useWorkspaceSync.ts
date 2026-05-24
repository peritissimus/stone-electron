import { useCallback } from 'react';
import { toast } from 'sonner';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTree } from '@renderer/hooks/useFileTree';
import { logger } from '@renderer/lib/logger';

export interface SyncSummary {
  workspaceId: string;
  notes: {
    created: number;
    updated: number;
    deleted: number;
    embedded: number;
    errors: string[];
  };
  notebooks: { created: number; updated: number; errors: string[] };
}

export interface SyncOptions {
  /**
   * Quiet by default — only toast when something actually changed (or failed).
   * The big top-bar Sync button passes silent: false to also confirm "nothing
   * to sync" on demand.
   */
  silent?: boolean;
}

export function useWorkspaceSync() {
  const { syncWorkspace, loadWorkspaces } = useWorkspaceAPI();
  const { loadFileTree } = useFileTreeAPI();
  const { loadNotes } = useNoteAPI();
  const { activeFolder } = useFileTree();

  return useCallback(
    async (opts: SyncOptions = {}): Promise<SyncSummary | null> => {
      const silent = opts.silent ?? false;
      try {
        const res = await syncWorkspace();
        if (!res.success || !res.data) {
          const message = res.error?.message || 'Sync failed';
          logger.error('Sync failed', res.error);
          toast.error(message);
          return null;
        }

        const summary = res.data as unknown as SyncSummary;
        logger.info('Sync complete', summary);

        await loadWorkspaces();
        await loadFileTree();
        await (activeFolder ? loadNotes({ folderPath: activeFolder }) : loadNotes());

        const created = summary.notes.created;
        const deleted = summary.notes.deleted;
        const embedded = summary.notes.embedded;

        if (created > 0 || deleted > 0) {
          const parts: string[] = [];
          if (created > 0) {
            parts.push(
              embedded === created
                ? `imported ${created}`
                : `imported ${created} (${embedded} indexed)`,
            );
          }
          if (deleted > 0) parts.push(`removed ${deleted}`);
          toast.success(`Workspace synced — ${parts.join(', ')}`);
        } else if (!silent) {
          toast.success('Workspace synced — nothing to update');
        }

        return summary;
      } catch (e) {
        logger.error('Sync error', e);
        toast.error('Sync failed');
        return null;
      }
    },
    [syncWorkspace, loadWorkspaces, loadFileTree, loadNotes, activeFolder],
  );
}
