/**
 * Tag IPC Handlers
 *
 * Uses services for business logic, not repositories directly.
 * Pattern: IPC Handler → Service → Repository → Database
 */

import { TAG_CHANNELS } from '@shared/constants/ipcChannels';
import { getTagService } from '../../services/TagService';
import { registerHandler, IpcError } from '../utils';

/**
 * Register all tag handlers
 */
export function registerTagHandlers() {
  const tagService = getTagService();

  // tags:create
  registerHandler(
    TAG_CHANNELS.CREATE,
    async (event, request: { name: string; color?: string }) => {
      try {
        return await tagService.createTag({
          name: request.name,
          color: request.color,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          throw new IpcError('DUPLICATE', 'Tag with this name already exists');
        }
        throw error;
      }
    },
  );

  // tags:delete
  registerHandler(TAG_CHANNELS.DELETE, async (event, request: { id: string }) => {
    try {
      const result = await tagService.deleteTag(request.id);
      return { success: true, affected_notes: result.affectedNotes };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new IpcError('NOT_FOUND', 'Tag not found');
      }
      throw error;
    }
  });

  // tags:getAll
  registerHandler(
    TAG_CHANNELS.GET_ALL,
    async (event, request: { sort?: 'name' | 'count' | 'recent' }) => {
      const tags = await tagService.getAllTags(request.sort);
      return { tags };
    },
  );

  // tags:addToNote
  registerHandler(
    TAG_CHANNELS.ADD_TO_NOTE,
    async (event, request: { noteId: string; tagIds: string[] }) => {
      try {
        const tags = await tagService.addTagsToNote(request.noteId, request.tagIds);
        return {
          success: true,
          noteId: request.noteId,
          tags,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new IpcError('NOT_FOUND', 'Note not found');
        }
        throw error;
      }
    },
  );

  // tags:removeFromNote
  registerHandler(
    TAG_CHANNELS.REMOVE_FROM_NOTE,
    async (event, request: { noteId: string; tagId: string }) => {
      await tagService.removeTagFromNote(request.noteId, request.tagId);
      return {
        success: true,
        noteId: request.noteId,
      };
    },
  );
}
