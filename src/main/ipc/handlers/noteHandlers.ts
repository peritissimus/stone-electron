/**
 * Note IPC Handlers
 */

import { BrowserWindow, dialog } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { NOTE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import type { Attachment, Note, Tag } from '@shared/types';
import { getRepositories } from '../../repositories';
import { registerHandler, IpcError } from '../utils';
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
  const [tags, attachments, notebook] = await Promise.all([
    repos.tag.getTagsForNote(note.id),
    repos.attachment.getAttachmentsForNote(note.id),
    note.notebookId ? repos.notebook.findById(note.notebookId) : Promise.resolve(null),
  ]);

  // Get folderPath from notebook or derive from filePath
  let folderPath: string | null = null;
  if (notebook) {
    folderPath = notebook.folderPath;
  } else if (note.filePath) {
    // Extract folder from file path (e.g., "Personal/Note.md" -> "Personal")
    const pathParts = note.filePath.split('/');
    if (pathParts.length > 1) {
      folderPath = pathParts.slice(0, -1).join('/');
    }
  }

  return {
    ...note,
    folderPath,
    tags,
    attachments,
  } as any;
}

function deriveFolderPath(
  note: Note,
  notebooksMap: Map<string, any>,
): string | null {
  if (note.notebookId) {
    const notebook = notebooksMap.get(note.notebookId);
    if (notebook) {
      return notebook.folderPath;
    }
  }

  if (note.filePath) {
    // Extract folder from file path (e.g., "Personal/Note.md" -> "Personal")
    const pathParts = note.filePath.split('/');
    if (pathParts.length > 1) {
      return pathParts.slice(0, -1).join('/');
    }
  }

  return null;
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
  if (notes.length === 0) {
    return [];
  }

  // Bulk load all relations in parallel (3-4 queries instead of N*3 queries)
  const noteIds = notes.map(n => n.id);
  const notebookIds = [...new Set(notes.map(n => n.notebookId).filter(Boolean) as string[])];

  const [tagsMap, attachmentsMap, notebooksMap] = await Promise.all([
    repos.tag.getTagsForNotes(noteIds),
    repos.attachment.getAttachmentsForNotes(noteIds),
    repos.notebook.findByIds(notebookIds),
  ]);

  // Map notes to enriched notes with O(1) lookups
  return notes.map(note => ({
    ...note,
    tags: tagsMap.get(note.id) || [],
    attachments: attachmentsMap.get(note.id) || [],
    folderPath: deriveFolderPath(note, notebooksMap),
  } as any));
}

/**
 * Register all note handlers
 */
export function registerNoteHandlers() {
  const repos = getRepositories();

  // notes:create
  registerHandler(NOTE_CHANNELS.CREATE, async (event, request: CreateNoteRequest) => {
    logger.info(`[IPC] notes:create "${request.title || 'Untitled'}"`);

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
  });

  // notes:update
  registerHandler(NOTE_CHANNELS.UPDATE, async (event, request: UpdateNoteRequest) => {
    const logId = request.title ? `"${request.title}"` : request.id.slice(0, 8);
    logger.info(`[IPC] notes:update ${logId}`);

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
  });

  // notes:delete
  registerHandler(NOTE_CHANNELS.DELETE, async (event, request: { id: string; permanent?: boolean }) => {
    logger.info(`[IPC] notes:delete ${request.permanent ? '(permanent)' : '(soft)'}`);

    if (request.permanent) {
      const deleted = await repos.note.permanentDelete(request.id);
      if (!deleted) {
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
  });

  // notes:get - Get note metadata only (no content)
  registerHandler(
    NOTE_CHANNELS.GET,
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
  );

  // notes:getByPath - Get note by file path
  registerHandler(
    NOTE_CHANNELS.GET_BY_PATH,
    async (event, request: { filePath: string }) => {
      logger.info(`[IPC] notes:getByPath "${request.filePath}"`);

      const note = await repos.note.findByFilePath(request.filePath);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found for file path');
      }

      const noteWithRelations = await buildNoteWithRelations(note, repos);
      return noteWithRelations;
    },
  );

  // notes:getContent - Get note content from file
  registerHandler(NOTE_CHANNELS.GET_CONTENT, async (event, request: { id: string }) => {
    const content = await repos.note.getContentById(request.id);
    if (content === null) {
      throw new IpcError('NOT_FOUND', 'Note content not found');
    }
    return { content };
  });

  // notes:getAll
  registerHandler(NOTE_CHANNELS.GET_ALL, async (event, request: GetAllNotesRequest) => {
    // Note: We no longer run a full sync here. The FileWatcherService
    // maintains DB <-> filesystem alignment for add/unlink events.
    const notes = await resolveNotesList(request, repos);
    const enrichedNotes = await enrichNotes(notes, repos);

    logger.info(`[IPC] notes:getAll → ${enrichedNotes.length} notes`);

    return {
      notes: enrichedNotes,
      total: enrichedNotes.length,
      hasMore: request.limit ? enrichedNotes.length > request.limit + (request.offset || 0) : false,
    };
  });

  // notes:favorite
  registerHandler(NOTE_CHANNELS.FAVORITE, async (event, request: { id: string }) => {
    const note = await repos.note.toggleFavorite(request.id);
    const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);
    return noteWithRelations;
  });

  // notes:pin
  registerHandler(NOTE_CHANNELS.PIN, async (event, request: { id: string }) => {
    const note = await repos.note.togglePin(request.id);
    const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);
    return noteWithRelations;
  });

  // notes:archive
  registerHandler(NOTE_CHANNELS.ARCHIVE, async (event, request: { id: string }) => {
    const note = await repos.note.toggleArchive(request.id);
    const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);
    return noteWithRelations;
  });

  // notes:getVersions
  registerHandler(
    NOTE_CHANNELS.GET_VERSIONS,
    async (event, request: { noteId: string; limit?: number; offset?: number }) => {
      const versions = await repos.version.getVersionSummary(request.noteId);
      return { versions, total: versions.length };
    },
  );

  // notes:restoreVersion
  registerHandler(
    NOTE_CHANNELS.RESTORE_VERSION,
    async (event, request: { noteId: string; versionId: string }) => {
      const version = await repos.version.findById(request.versionId);
      if (!version) {
        throw new IpcError('NOT_FOUND', 'Version not found');
      }

      // Create a new version from current state before restoring
      const currentNote = await repos.note.findById(request.noteId);
      if (currentNote) {
        const currentContent = await repos.note.getContentById(currentNote.id);
        await repos.version.createVersion(
          currentNote.id,
          currentNote.title || 'Untitled',
          currentContent || '',
        );
      }

      // Restore the version
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

      const restoredContent = await repos.note.getContentById(note.id);

      return {
        id: note.id,
        title: note.title,
        content: restoredContent,
        versionNumber: version.versionNumber,
        message: 'Version restored successfully',
      };
    },
  );

  // notes:getBacklinks
  registerHandler(NOTE_CHANNELS.GET_BACKLINKS, async (event, request: { noteId: string }) => {
    const backlinks = await repos.note.getBacklinks(request.noteId);
    return { backlinks };
  });

  // notes:getForwardLinks
  registerHandler(NOTE_CHANNELS.GET_FORWARD_LINKS, async (event, request: { noteId: string }) => {
    const forwardLinks = await repos.note.getForwardLinks(request.noteId);
    return { forwardLinks };
  });

  // notes:getGraphData
  registerHandler(NOTE_CHANNELS.GET_GRAPH_DATA, async () => {
    const graphData = await repos.note.getGraphData();
    return graphData;
  });

  // notes:move
  registerHandler(
    NOTE_CHANNELS.MOVE,
    async (event, request: { id: string; folderPath: string | null }) => {
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

      // Move the note by updating its folderPath
      const updateData: any = {
        folderPath: request.folderPath,
      };
      const note = await repos.note.update(request.id, updateData);

      const noteWithRelations = await buildNoteResponse(note, repos, EVENTS.NOTE_UPDATED);
      return noteWithRelations;
    },
  );

  // notes:getAllTodos - Get all todo items from all notes
  // Scans markdown files directly for Logseq-style task patterns
  registerHandler(NOTE_CHANNELS.GET_ALL_TODOS, async () => {
    const notes = await repos.note.findAll();
    logger.info('[NoteHandlers] GET_ALL_TODOS - Scanning', notes.length, 'notes');

    const todos: any[] = [];
    const taskPattern = /^(\s*)(?:[-*]\s+)?(TODO|DOING|DONE|WAITING|HOLD|CANCELED|CANCELLED|IDEA)\s+(.+)$/gim;

    for (const note of notes) {
      try {
        // Get raw markdown content (not HTML) - silently skip missing files
        const content = await repos.note.getRawContentById(note.id);
        if (!content) continue;

        // Find all task lines in the markdown
        let match;
        let index = 0;
        while ((match = taskPattern.exec(content)) !== null) {
          const stateRaw = match[2].toLowerCase();
          const state = stateRaw === 'cancelled' ? 'canceled' : stateRaw;
          const text = match[3].trim();
          const isDone = state === 'done' || state === 'canceled';

          if (text) {
            todos.push({
              id: `${note.id}-${index}`,
              noteId: note.id,
              noteTitle: note.title,
              notePath: note.filePath,
              text,
              state,
              checked: isDone,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
            });
            index++;
          }
        }
      } catch {
        // Silently skip notes with missing files (orphaned DB entries)
      }
    }

    logger.info('[NoteHandlers] GET_ALL_TODOS - Found', todos.length, 'todos');
    return todos;
  });

  // notes:updateTaskState - Update a task's state in a note's markdown file
  registerHandler(
    NOTE_CHANNELS.UPDATE_TASK_STATE,
    async (
      event,
      request: {
        noteId: string;
        taskIndex: number;
        newState: string;
      },
    ) => {
      const { noteId, taskIndex, newState } = request;
      logger.info('[NoteHandlers] UPDATE_TASK_STATE', { noteId, taskIndex, newState });

      // Get raw markdown content
      const content = await repos.note.getRawContentById(noteId);
      if (!content) {
        throw new IpcError('NOT_FOUND', 'Note content not found');
      }

      // Find and replace the task at the specified index
      const taskPattern =
        /^(\s*)([-*]\s+)?(TODO|DOING|DONE|WAITING|HOLD|CANCELED|CANCELLED|IDEA)\s+(.+)$/gim;
      let currentIndex = 0;
      let found = false;

      const newContent = content.replace(
        taskPattern,
        (match, indent, listMarker, _state, text) => {
          if (currentIndex === taskIndex) {
            found = true;
            const prefix = listMarker || '- ';
            currentIndex++;
            return `${indent}${prefix}${newState.toUpperCase()} ${text}`;
          }
          currentIndex++;
          return match;
        },
      );

      if (!found) {
        throw new IpcError('NOT_FOUND', `Task at index ${taskIndex} not found`);
      }

      // Write back to file
      const note = await repos.note.findById(noteId);
      if (!note?.filePath || !note?.workspaceId) {
        throw new IpcError('NOT_FOUND', 'Note file path not found');
      }

      const workspace = await repos.workspace.findById(note.workspaceId);
      if (!workspace) {
        throw new IpcError('NOT_FOUND', 'Workspace not found');
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const absolutePath = path.join(workspace.folderPath, note.filePath);

      // Prepend title heading if it was stripped
      const titleHeading = `# ${note.title}\n\n`;
      const contentWithTitle = titleHeading + newContent;

      await fs.writeFile(absolutePath, contentWithTitle, 'utf-8');

      logger.info('[NoteHandlers] Task state updated successfully');
      return { success: true };
    },
  );

  // notes:exportHtml - Export note as HTML file
  registerHandler(
    NOTE_CHANNELS.EXPORT_HTML,
    async (event, request: { id: string; content: string; title: string }) => {
      const note = await repos.note.findById(request.id);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        throw new IpcError('NO_WINDOW', 'No focused window');
      }

      const defaultName = `${request.title || 'Untitled'}.html`;
      const result = await dialog.showSaveDialog(window, {
        title: 'Export as HTML',
        defaultPath: defaultName,
        filters: [{ name: 'HTML Files', extensions: ['html'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      // Create a styled HTML document
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${request.title || 'Untitled'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, monospace; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666; }
    ul, ol { margin: 1em 0; padding-left: 2em; }
    li { margin: 0.25em 0; }
    a { color: #0066cc; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
    .task-list-item { list-style: none; margin-left: -1.5em; }
    .task-list-item input { margin-right: 0.5em; }
  </style>
</head>
<body>
  <h1>${request.title || 'Untitled'}</h1>
  ${request.content}
</body>
</html>`;

      await fs.writeFile(result.filePath, htmlContent, 'utf-8');
      logger.info(`[NoteHandlers] Exported HTML to ${result.filePath}`);

      return { success: true, filePath: result.filePath };
    },
  );

  // notes:exportPdf - Export note as PDF file
  // Uses pre-rendered content from the renderer (includes Mermaid SVGs, syntax highlighting)
  registerHandler(
    NOTE_CHANNELS.EXPORT_PDF,
    async (event, request: { id: string; content: string; title: string }) => {
      const note = await repos.note.findById(request.id);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        throw new IpcError('NO_WINDOW', 'No focused window');
      }

      const defaultName = `${request.title || 'Untitled'}.pdf`;
      const result = await dialog.showSaveDialog(window, {
        title: 'Export as PDF',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      // Create a hidden window for PDF generation
      const printWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      // The content is already a complete HTML document with styles from the renderer
      // It includes pre-rendered Mermaid SVGs and syntax highlighting
      const { app } = await import('electron');
      const tempDir = app.getPath('temp');
      const tempHtmlPath = path.join(tempDir, `stone-export-${Date.now()}.html`);

      try {
        // Write the pre-built HTML to temp file
        await fs.writeFile(tempHtmlPath, request.content, 'utf-8');

        // Load the HTML
        await printWindow.loadFile(tempHtmlPath);

        // Wait for rendering to complete
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 500); // Short wait since content is already rendered
        });

        const pdfData = await printWindow.webContents.printToPDF({
          printBackground: true,
          margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
          pageSize: 'A4',
        });

        await fs.writeFile(result.filePath, pdfData);
        logger.info(`[NoteHandlers] Exported PDF to ${result.filePath}`);

        return { success: true, filePath: result.filePath };
      } finally {
        printWindow.close();
        // Clean up temp file
        try {
          await fs.unlink(tempHtmlPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    },
  );

  // notes:exportMarkdown - Export note as Markdown file
  registerHandler(
    NOTE_CHANNELS.EXPORT_MARKDOWN,
    async (event, request: { id: string; title: string }) => {
      const note = await repos.note.findById(request.id);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      // Get markdown content directly from file
      const markdownContent = await repos.note.getRawContentById(request.id);
      if (!markdownContent) {
        throw new IpcError('NOT_FOUND', 'Note content not found');
      }

      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        throw new IpcError('NO_WINDOW', 'No focused window');
      }

      const defaultName = `${request.title || 'Untitled'}.md`;
      const result = await dialog.showSaveDialog(window, {
        title: 'Export as Markdown',
        defaultPath: defaultName,
        filters: [{ name: 'Markdown Files', extensions: ['md'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      await fs.writeFile(result.filePath, markdownContent, 'utf-8');
      logger.info(`[NoteHandlers] Exported Markdown to ${result.filePath}`);

      return { success: true, filePath: result.filePath };
    },
  );
}
