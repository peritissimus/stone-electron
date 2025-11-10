/**
 * Note IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { NOTE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import type { Attachment, Note, Tag } from '@shared/types';
import { getRepositories } from '../../repositories';
import { createHandler, IpcError } from '../utils';
import { logger } from '../../utils/logger';

type RepositoriesInstance = ReturnType<typeof getRepositories>;

type NoteWithRelations = Note & {
  tags: Tag[];
  attachments: Attachment[];
};

interface CreateNoteRequest {
  title?: string;
  content?: string;
  folderPath?: string | null;
  tags?: string[];
}

interface UpdateNoteRequest {
  id: string;
  title?: string;
  content?: string;
  notebookId?: string | null;
  folderPath?: string | null;
  tags?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

interface GetAllNotesRequest {
  notebookId?: string;
  folderPath?: string;
  tagId?: string;
  is_favorite?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
  is_deleted?: boolean;
  sort?: 'updated' | 'created' | 'title';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

type NoteCreateData = Partial<Note> & { folderPath?: string | null };
type NoteUpdateData = Partial<Note> & { content?: string; folderPath?: string | null };

async function buildNoteWithRelations(
  note: Note,
  repos: RepositoriesInstance,
): Promise<NoteWithRelations> {
  const [tags, attachments] = await Promise.all([
    repos.tag.getTagsForNote(note.id),
    repos.attachment.getAttachmentsForNote(note.id),
  ]);

  return {
    ...note,
    tags,
    attachments,
  };
}

function broadcastNoteEvent(eventName: string, note: NoteWithRelations) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(eventName, { note });
  });
}

async function buildNoteResponse(
  note: Note,
  repos: RepositoriesInstance,
  eventName?: string,
): Promise<NoteWithRelations> {
  const noteWithRelations = await buildNoteWithRelations(note, repos);

  if (eventName) {
    broadcastNoteEvent(eventName, noteWithRelations);
  }

  return noteWithRelations;
}

function resolveSortField(sort?: GetAllNotesRequest['sort']): keyof Note {
  switch (sort) {
    case 'created':
      return 'createdAt';
    case 'title':
      return 'title';
    default:
      return 'updatedAt';
  }
}

function resolveSortOrder(order?: GetAllNotesRequest['order']): 'ASC' | 'DESC' {
  return order === 'asc' ? 'ASC' : 'DESC';
}

async function resolveDefaultNoteList(
  request: GetAllNotesRequest,
  repos: RepositoriesInstance,
): Promise<Note[]> {
  const workspace = await repos.workspace.getActive();

  const where: Partial<Note> = {
    isDeleted: request.is_deleted ?? false,
  };

  if (workspace) {
    where.workspaceId = workspace.id;
  }

  const sortField = resolveSortField(request.sort);
  const sortOrder = resolveSortOrder(request.order);

  return repos.note.findAll({
    where,
    sort: {
      field: sortField,
      order: sortOrder,
    },
    limit: request.limit,
    offset: request.offset,
  });
}

async function resolveNotesList(
  request: GetAllNotesRequest,
  repos: RepositoriesInstance,
): Promise<Note[]> {
  if (request.tagId) {
    return repos.note.findByTags([request.tagId]);
  }

  if (request.is_favorite === true) {
    return repos.note.getFavorites();
  }

  if (request.is_pinned === true) {
    return repos.note.getPinned();
  }

  if (request.is_deleted === true) {
    return repos.note.getDeleted();
  }

  if (request.is_archived === true) {
    return repos.note.getArchived();
  }

  if (request.folderPath) {
    return repos.note.findByFolder(request.folderPath);
  }

  if (request.notebookId) {
    return repos.note.findByNotebook(request.notebookId);
  }

  return resolveDefaultNoteList(request, repos);
}

async function enrichNotes(
  notes: Note[],
  repos: RepositoriesInstance,
): Promise<NoteWithRelations[]> {
  return Promise.all(notes.map((note) => buildNoteWithRelations(note, repos)));
}

/**
 * Register all note handlers
 */
export function registerNoteHandlers() {
  const repos = getRepositories();

  // notes:create
  ipcMain.handle(
    NOTE_CHANNELS.CREATE,
    createHandler(async (event, request: CreateNoteRequest) => {
      const createData: NoteCreateData = {
        title: request.title || 'Untitled',
        notebookId: null,
        folderPath: request.folderPath ?? undefined,
      };

      const note = await repos.note.create(createData);

      if (request.content && note.filePath && note.workspaceId) {
        const contentUpdate: NoteUpdateData = { content: request.content };
        await repos.note.update(note.id, contentUpdate);
      }

      if (request.tags && request.tags.length > 0) {
        await repos.tag.setTagsForNote(note.id, request.tags);
      }

      const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_CREATED);

      return noteWithRelations;
    }),
  );

  // notes:update
  ipcMain.handle(
    NOTE_CHANNELS.UPDATE,
    createHandler(async (event, request: UpdateNoteRequest) => {
      const oldNote = await repos.note.findById(request.id);
      if (!oldNote) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      if (request.content) {
        const currentContent = await repos.note.getContentById(oldNote.id);
        if (currentContent && request.content !== currentContent) {
          await repos.version.createVersion(
            oldNote.id,
            oldNote.title || 'Untitled',
            currentContent,
          );
        }
      }

      const updateData: NoteUpdateData = {};
      if (request.title !== undefined) updateData.title = request.title;
      if (request.notebookId !== undefined) updateData.notebookId = request.notebookId;
      if (request.folderPath !== undefined) updateData.folderPath = request.folderPath;
      if (request.content !== undefined) updateData.content = request.content;
      if (request.isFavorite !== undefined) updateData.isFavorite = request.isFavorite;
      if (request.isPinned !== undefined) updateData.isPinned = request.isPinned;
      if (request.isArchived !== undefined) updateData.isArchived = request.isArchived;

      const note = await repos.note.update(request.id, updateData);

      if (request.tags) {
        await repos.tag.setTagsForNote(note.id, request.tags);
      }

      const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);

      return noteWithRelations;
    }),
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

  // notes:get - Get note metadata only (no content)
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

        const noteWithRelations = await buildNoteWithRelations(note, repos);

        const result: Record<string, unknown> = {
          ...noteWithRelations,
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

  // notes:getContent - Get note content from file
  ipcMain.handle(
    NOTE_CHANNELS.GET_CONTENT,
    createHandler(async (event, request: { id: string }) => {
      const content = await repos.note.getContentById(request.id);
      if (content === null) {
        throw new IpcError('NOT_FOUND', 'Note content not found');
      }
      return { content };
    }),
  );

  // notes:getAll
  ipcMain.handle(
    NOTE_CHANNELS.GET_ALL,
    createHandler(async (event, request: GetAllNotesRequest) => {
      // Note: We no longer run a full sync here. The FileWatcherService
      // maintains DB <-> filesystem alignment for add/unlink events.
      // Running sync on every list fetch caused redundant scans and log spam.
      logger.info('[IPC][notes:getAll] request', {
        notebookId: request.notebookId,
        tagId: request.tagId,
        is_favorite: request.is_favorite,
        is_pinned: request.is_pinned,
        is_archived: request.is_archived,
        is_deleted: request.is_deleted,
      });

      const notes = await resolveNotesList(request, repos);
      const enrichedNotes = await enrichNotes(notes, repos);

      const total = enrichedNotes.length;
      logger.info('[IPC][notes:getAll] returning count', total);

      return {
        notes: enrichedNotes,
        total,
        hasMore: request.limit ? total > request.limit + (request.offset || 0) : false,
      };
    }),
  );

  // notes:favorite
  ipcMain.handle(
    NOTE_CHANNELS.FAVORITE,
    createHandler(async (event, request: { id: string }) => {
      const note = await repos.note.toggleFavorite(request.id);
      const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);

      return noteWithRelations;
    }),
  );

  // notes:pin
  ipcMain.handle(
    NOTE_CHANNELS.PIN,
    createHandler(async (event, request: { id: string }) => {
      const note = await repos.note.togglePin(request.id);
      const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);

      return noteWithRelations;
    }),
  );

  // notes:archive
  ipcMain.handle(
    NOTE_CHANNELS.ARCHIVE,
    createHandler(async (event, request: { id: string }) => {
      const note = await repos.note.toggleArchive(request.id);
      const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);

      return noteWithRelations;
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
        // Create a version before restoring
        const currentContent = await repos.note.getContentById(currentNote.id);
        await repos.version.createVersion(
          currentNote.id,
          currentNote.title || 'Untitled',
          currentContent || '',
        );
      }

      // Restore the version (content is passed via the data parameter)
      const restoreData: NoteUpdateData = {
        title: version.title,
        content: version.content,
      };
      const note = await repos.note.update(request.noteId, restoreData);
      const enrichedNote = await buildNoteWithRelations(note, repos);

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_VERSION_RESTORED, { note: enrichedNote, version });
      });

      // Get the restored content
      const restoredContent = await repos.note.getContentById(note.id);

      return {
        id: note.id,
        title: note.title,
        content: restoredContent,
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

  // notes:move
  ipcMain.handle(
    NOTE_CHANNELS.MOVE,
    createHandler(async (event, request: { id: string; folderPath: string | null }) => {
      const oldNote = await repos.note.findById(request.id);
      if (!oldNote) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      // Create a version before moving
      const currentContent = await repos.note.getContentById(oldNote.id);
      if (currentContent) {
        await repos.version.createVersion(
          oldNote.id,
          oldNote.title || 'Untitled',
          currentContent,
        );
      }

      // Move the note by updating its folderPath (using type assertion like update handler does)
      const updateData: any = {
        folderPath: request.folderPath,
      };
      const note = await repos.note.update(request.id, updateData);

      const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);

      return noteWithRelations;
    }),
  );
}
