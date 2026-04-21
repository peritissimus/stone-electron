import { useCallback } from 'react';
import { quickNoteAPI, type QuickNoteSlot } from '@renderer/api';
import { useNavigateToNote } from '@renderer/navigation';
import { logger } from '@renderer/lib/logger';

/**
 * Hook for "quick note" actions — creating a note in a named slot (personal,
 * work) without the renderer knowing which folder backs that slot.
 */
export function useQuickNoteActions() {
  const navigateToNote = useNavigateToNote();

  const createInSlot = useCallback(
    async (slot: QuickNoteSlot): Promise<string | null> => {
      const response = await quickNoteAPI.createInSlot(slot);
      if (!response.success || !response.data) {
        logger.error('[useQuickNoteActions] createInSlot failed', response.error);
        return null;
      }
      navigateToNote(response.data.noteId);
      return response.data.noteId;
    },
    [navigateToNote],
  );

  const createPersonal = useCallback(() => createInSlot('personal'), [createInSlot]);
  const createWork = useCallback(() => createInSlot('work'), [createInSlot]);

  return { createInSlot, createPersonal, createWork };
}
