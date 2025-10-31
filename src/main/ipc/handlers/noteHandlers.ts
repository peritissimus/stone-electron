/**
 * Note IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { NOTE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { createHandler, IpcError } from '../utils';

/**
 * Register all note handlers
 */
export function registerNoteHandlers() {
  const repos = getRepositories();

  // notes:create
  ipcMain.handle(
    NOTE_CHANNELS.CREATE,
    createHandler(
      async (
        event,
        request: { title?: string; content?: string; notebookId?: string; tags?: string[] },
      ) => {
        const note = await repos.note.create({
          title: request.title || 'Untitled',
          content: request.content || '',
          notebookId: request.notebookId || null,
        });

        // Add tags if provided
        if (request.tags && request.tags.length > 0) {
          await repos.tag.setTagsForNote(note.id, request.tags);
        }

        // Get tags for response
        const tags = await repos.tag.getTagsForNote(note.id);
        const noteWithTags = { ...note, tags };

        // Broadcast event
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.NOTE_CREATED, { note: noteWithTags });
        });

        return noteWithTags;
      },
    ),
  );

  // notes:update
  ipcMain.handle(
    NOTE_CHANNELS.UPDATE,
    createHandler(
      async (
        event,
        request: {
          id: string;
          title?: string;
          content?: string;
          notebookId?: string;
          tags?: string[];
        },
      ) => {
        const oldNote = await repos.note.findById(request.id);
        if (!oldNote) {
          throw new IpcError('NOT_FOUND', 'Note not found');
        }

        // Create version if content changed significantly
        if (request.content && request.content !== (oldNote.content || '')) {
          await repos.version.createVersion(
            oldNote.id,
            oldNote.title || 'Untitled',
            oldNote.content || '',
          );
        }

        // Update note
        const updateData: Record<string, unknown> = {};
        if (request.title !== undefined) updateData.title = request.title;
        if (request.content !== undefined) updateData.content = request.content;
        if (request.notebookId !== undefined) updateData.notebookId = request.notebookId;

        const note = await repos.note.update(request.id, updateData);

        // Update tags if provided
        if (request.tags) {
          await repos.tag.setTagsForNote(note.id, request.tags);
        }

        const tags = await repos.tag.getTagsForNote(note.id);
        const noteWithTags = { ...note, tags };

        // Broadcast event
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.NOTE_UPDATED, { note: noteWithTags });
        });

        return noteWithTags;
      },
    ),
  );

  // notes:delete
  ipcMain.handle(
    NOTE_CHANNELS.DELETE,
    createHandler(async (event, request: { id: string; permanent?: boolean }) => {
      if (request.permanent) {
        const success = await repos.note.permanentDelete(request.id);
        if (!success) {
          throw new IpcError('NOT_FOUND', 'Note not found');
        }
      } else {
        await repos.note.softDelete(request.id);
      }

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_DELETED, { id: request.id });
      });

      return { success: true, id: request.id };
    }),
  );

  // notes:get
  ipcMain.handle(
    NOTE_CHANNELS.GET,
    createHandler(
      async (
        event,
        request: { id: string; include_versions?: boolean; include_backlinks?: boolean },
      ) => {
        const note = await repos.note.findById(request.id);
        if (!note) {
          throw new IpcError('NOT_FOUND', 'Note not found');
        }

        const tags = await repos.tag.getTagsForNote(note.id);
        const attachments = await repos.attachment.getAttachmentsForNote(note.id);

        const result: Record<string, unknown> = {
          ...note,
          tags,
          attachments,
        };

        if (request.include_versions) {
          result.versions = await repos.version.getVersionSummary(note.id);
        }

        if (request.include_backlinks) {
          result.backlinks = await repos.note.getBacklinks(note.id);
        }

        return result;
      },
    ),
  );

  // notes:getAll
  ipcMain.handle(
    NOTE_CHANNELS.GET_ALL,
    createHandler(
      async (
        event,
        request: {
          notebookId?: string;
          tagId?: string;
          is_favorite?: boolean;
          is_pinned?: boolean;
          is_archived?: boolean;
          is_deleted?: boolean;
          sort?: 'updated' | 'created' | 'title';
          order?: 'asc' | 'desc';
          limit?: number;
          offset?: number;
        },
      ) => {
        let notes;

        if (request.tagId) {
          notes = await repos.note.findByTags([request.tagId]);
        } else if (request.is_favorite === true) {
          notes = await repos.note.getFavorites();
        } else if (request.is_pinned === true) {
          notes = await repos.note.getPinned();
        } else if (request.is_deleted === true) {
          notes = await repos.note.getDeleted();
        } else if (request.is_archived === true) {
          notes = await repos.note.getArchived();
        } else if (request.notebookId) {
          notes = await repos.note.findByNotebook(request.notebookId);
        } else {
          const where: Record<string, unknown> = {};
          if (request.is_deleted !== undefined) where.isDeleted = request.is_deleted ? 1 : 0;

          const sortField =
            request.sort === 'updated'
              ? 'updatedAt'
              : request.sort === 'created'
                ? 'createdAt'
                : request.sort || 'updatedAt';
          notes = await repos.note.findAll({
            where,
            sort: {
              field: sortField as any,
              order: (request.order?.toUpperCase() as 'ASC' | 'DESC') || 'DESC',
            },
            limit: request.limit,
            offset: request.offset,
          });
        }

        const enrichedNotes = await Promise.all(
          notes.map(async (note) => {
            const noteTags = await repos.tag.getTagsForNote(note.id);
            const attachments = await repos.attachment.getAttachmentsForNote(note.id);
            return {
              ...note,
              tags: noteTags,
              contentPreview: (note.content || '').substring(0, 200),
              tagCount: noteTags.length,
              attachmentCount: attachments.length,
            };
          }),
        );

        const total = enrichedNotes.length;

        return {
          notes: enrichedNotes,
          total,
          hasMore: request.limit ? total > request.limit + (request.offset || 0) : false,
        };
      },
    ),
  );

  // notes:favorite
  ipcMain.handle(
    NOTE_CHANNELS.FAVORITE,
    createHandler(async (event, request: { id: string }) => {
      const note = await repos.note.toggleFavorite(request.id);

      const tags = await repos.tag.getTagsForNote(note.id);
      const noteWithTags = { ...note, tags };

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_UPDATED, { note: noteWithTags });
      });

      return noteWithTags;
    }),
  );

  // notes:pin
  ipcMain.handle(
    NOTE_CHANNELS.PIN,
    createHandler(async (event, request: { id: string }) => {
      const note = await repos.note.togglePin(request.id);

      const tags = await repos.tag.getTagsForNote(note.id);
      const noteWithTags = { ...note, tags };

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_UPDATED, { note: noteWithTags });
      });

      return noteWithTags;
    }),
  );

  // notes:archive
  ipcMain.handle(
    NOTE_CHANNELS.ARCHIVE,
    createHandler(async (event, request: { id: string }) => {
      const note = await repos.note.toggleArchive(request.id);

      const tags = await repos.tag.getTagsForNote(note.id);
      const noteWithTags = { ...note, tags };

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_UPDATED, { note: noteWithTags });
      });

      return noteWithTags;
    }),
  );

  // notes:getVersions
  ipcMain.handle(
    NOTE_CHANNELS.GET_VERSIONS,
    createHandler(async (event, request: { noteId: string; limit?: number; offset?: number }) => {
      const versions = await repos.version.getVersionSummary(request.noteId);
      const total = versions.length;

      return { versions, total };
    }),
  );

  // notes:restoreVersion
  ipcMain.handle(
    NOTE_CHANNELS.RESTORE_VERSION,
    createHandler(async (event, request: { noteId: string; versionId: string }) => {
      const version = await repos.version.findById(request.versionId);
      if (!version) {
        throw new IpcError('NOT_FOUND', 'Version not found');
      }

      // Create a new version from current state before restoring
      const currentNote = await repos.note.findById(request.noteId);
      if (currentNote) {
        await repos.version.createVersion(
          currentNote.id,
          currentNote.title || 'Untitled',
          currentNote.content || '',
        );
      }

      // Restore the version
      const note = await repos.note.update(request.noteId, {
        title: version.title,
        content: version.content,
      });

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_VERSION_RESTORED, { note, version });
      });

      return {
        id: note.id,
        title: note.title,
        content: note.content,
        versionNumber: version.versionNumber,
        message: 'Version restored successfully',
      };
    }),
  );

  // notes:getBacklinks
  ipcMain.handle(
    NOTE_CHANNELS.GET_BACKLINKS,
    createHandler(async (event, request: { noteId: string }) => {
      const backlinks = await repos.note.getBacklinks(request.noteId);
      return { backlinks };
    }),
  );
}
