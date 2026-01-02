/**
 * Notebook IPC Handlers
 *
 * Uses services for business logic, not repositories directly.
 * Pattern: IPC Handler → Service → Repository → Database
 */

import { NOTEBOOK_CHANNELS } from '@shared/constants/ipcChannels';
import { getNotebookService } from '../../services/NotebookService';
import { registerHandler, IpcError } from '../utils';

/**
 * Register all notebook handlers
 */
export function registerNotebookHandlers() {
  const notebookService = getNotebookService();

  // notebooks:create
  registerHandler(
    NOTEBOOK_CHANNELS.CREATE,
    async (
      event,
      request: { name: string; parentId?: string; icon?: string; color?: string; position?: number },
    ) => {
      return notebookService.createNotebook({
        name: request.name,
        parentId: request.parentId,
        icon: request.icon,
        color: request.color,
        position: request.position,
      });
    },
  );

  // notebooks:update
  registerHandler(
    NOTEBOOK_CHANNELS.UPDATE,
    async (
      event,
      request: { id: string; name?: string; icon?: string; color?: string; position?: number },
    ) => {
      return notebookService.updateNotebook(request.id, {
        name: request.name,
        icon: request.icon,
        color: request.color,
        position: request.position,
      });
    },
  );

  // notebooks:delete
  registerHandler(
    NOTEBOOK_CHANNELS.DELETE,
    async (event, request: { id: string; delete_notes?: boolean }) => {
      await notebookService.deleteNotebook(request.id, request.delete_notes);
      return { success: true, deleted_notebook_count: 1, orphaned_note_count: 0 };
    },
  );

  // notebooks:getAll
  registerHandler(
    NOTEBOOK_CHANNELS.GET_ALL,
    async (event, request: { include_counts?: boolean; flat?: boolean }) => {
      if (request.flat) {
        const notebooks = await notebookService.getAllFlat(request.include_counts);
        return { notebooks };
      }

      const tree = await notebookService.getTree();
      return { notebooks: tree };
    },
  );

  // notebooks:move
  registerHandler(
    NOTEBOOK_CHANNELS.MOVE,
    async (event, request: { id: string; parentId?: string; position?: number }) => {
      try {
        const notebook = await notebookService.moveNotebook(
          request.id,
          request.parentId ?? null,
          request.position,
        );

        return {
          id: notebook.id,
          parentId: notebook.parentId,
          position: notebook.position,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('Cannot move notebook')) {
          throw new IpcError('INVALID_OPERATION', error.message);
        }
        throw error;
      }
    },
  );
}
