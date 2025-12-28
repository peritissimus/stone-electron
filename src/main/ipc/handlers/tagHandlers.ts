/**
 * Tag IPC Handlers
 */

import { BrowserWindow } from 'electron';
import { TAG_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { registerHandler, IpcError } from '../utils';

/**
 * Register all tag handlers
 */
export function registerTagHandlers() {
  const repos = getRepositories();

  // tags:create
  registerHandler(
    TAG_CHANNELS.CREATE,
    async (event, request: { name: string; color?: string }) => {
      // Check if tag already exists
      const existing = await repos.tag.findOne({ name: request.name });
      if (existing) {
        throw new IpcError('DUPLICATE', 'Tag with this name already exists');
      }

      const tag = await repos.tag.create({
        name: request.name,
        color: request.color || '#6b7280',
      });

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.TAG_CREATED, { tag });
      });

      return { ...tag, note_count: 0 };
    }
  );

  // tags:delete
  registerHandler(
    TAG_CHANNELS.DELETE,
    async (event, request: { id: string }) => {
      const tag = await repos.tag.findById(request.id);
      if (!tag) {
        throw new IpcError('NOT_FOUND', 'Tag not found');
      }

      const allTags = await repos.tag.getAllWithCounts();
      const noteCount = allTags.find((t) => t.id === request.id)?.note_count || 0;

      await repos.tag.deleteWithAssociations(request.id);

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.TAG_DELETED, { id: request.id });
      });

      return { success: true, affected_notes: noteCount };
    }
  );

  // tags:getAll
  registerHandler(
    TAG_CHANNELS.GET_ALL,
    async (event, request: { sort?: 'name' | 'count' | 'recent' }) => {
      const tags = await repos.tag.getAllWithCounts();

      // Sort based on request
      if (request.sort === 'count') {
        tags.sort((a, b) => b.note_count - a.note_count || a.name.localeCompare(b.name));
      } else if (request.sort === 'recent') {
        tags.sort((a, b) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });
      } else {
        tags.sort((a, b) => a.name.localeCompare(b.name));
      }

      return { tags };
    }
  );

  // tags:addToNote
  registerHandler(
    TAG_CHANNELS.ADD_TO_NOTE,
    async (event, request: { noteId: string; tagIds: string[] }) => {
      const note = await repos.note.findById(request.noteId);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      // Add each tag
      for (const tagId of request.tagIds) {
        await repos.tag.addToNote(request.noteId, tagId);
      }

      const tags = await repos.tag.getTagsForNote(request.noteId);

      return {
        success: true,
        noteId: request.noteId,
        tags,
      };
    }
  );

  // tags:removeFromNote
  registerHandler(
    TAG_CHANNELS.REMOVE_FROM_NOTE,
    async (event, request: { noteId: string; tagId: string }) => {
      await repos.tag.removeFromNote(request.noteId, request.tagId);

      return {
        success: true,
        noteId: request.noteId,
      };
    }
  );
}
