/**
 * Note IPC Handlers
 */

import { BrowserWindow, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
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
    logger.info(`[IPC] notes:update ${request.title ? `"${request.title}"` : request.id.slice(0, 8)}`);

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
  registerHandler(NOTE_CHANNELS.GET_ALL_TODOS, async () => {
    const jsdom = await import('jsdom');
    const { JSDOM } = jsdom;

    const notes = await repos.note.findAll();
    const todos: any[] = [];

    for (const note of notes) {
      try {
        const content = await repos.note.getContentById(note.id);
        if (!content) continue;

        const dom = new JSDOM(content);
        const document = dom.window.document;
        const taskItems = document.querySelectorAll('li[data-type="taskItem"]');

        taskItems.forEach((taskItem, index) => {
          const state = taskItem.getAttribute('data-state') || 'todo';
          const checked = taskItem.getAttribute('data-checked') === 'true';

          const contentDiv = taskItem.querySelector('div');
          const text = contentDiv?.textContent?.trim() || '';

          if (text) {
            todos.push({
              id: `${note.id}-${index}`,
              noteId: note.id,
              noteTitle: note.title,
              notePath: note.filePath,
              text,
              state,
              checked,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
            });
          }
        });
      } catch (error) {
        logger.warn('[NoteHandlers] Failed to extract todos from note', {
          noteId: note.id,
          error,
        });
      }
    }

    return todos;
  });

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

      // Create a hidden window for PDF generation with web security disabled for CDN access
      const printWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // Allow loading CDN resources
        },
      });

      // Write HTML to a temp file so we can load CDN resources
      const { app } = await import('electron');
      const tempDir = app.getPath('temp');
      const tempHtmlPath = path.join(tempDir, `stone-export-${Date.now()}.html`);

      // Comprehensive PDF styles matching the editor exactly
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:;">
  <!-- Load the exact fonts used in the editor -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600&family=Patrick+Hand&display=swap" rel="stylesheet">
  <style>
    /* CSS Variables matching the editor */
    :root {
      --font-editor-body: 'Barlow', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-editor-heading: 'Barlow Condensed', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'Fira Code', 'SF Mono', ui-monospace, Menlo, Monaco, monospace;
      --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

      /* Colors - Light theme from editor */
      --foreground: #1f1f1f;
      --muted-foreground: #737373;
      --border: #d9d9d9;
      --muted: #f0f0f0;
      --primary: #0080ff;
      --accent: #e6f3ff;
      --accent-foreground: #0059b3;
      --code-bg: #f5f5f5;
      --code-text: #2e2e2e;
      --code-keyword: #7c3aed;
      --code-string: #16a34a;
      --code-number: #ea580c;
      --code-function: #0066cc;
      --code-comment: #8c8c8c;
    }

    * { box-sizing: border-box; }

    body {
      font-family: var(--font-editor-body);
      font-size: 16px;
      line-height: 1.65;
      letter-spacing: -0.003em;
      color: var(--foreground);
      max-width: 900px;
      margin: 0 auto;
      padding: 48px 64px;
      background: white;
      -webkit-font-smoothing: antialiased;
    }

    /* Document Title - Large like editor H1 */
    .doc-title {
      font-family: var(--font-editor-heading);
      font-size: 48px;
      font-weight: 700;
      letter-spacing: -0.022em;
      line-height: 1.2;
      margin: 0 0 32px 0;
      color: var(--foreground);
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }

    /* Headings - Match editor exactly */
    h1 {
      font-family: var(--font-editor-heading);
      font-size: 48px;
      font-weight: 700;
      letter-spacing: -0.022em;
      line-height: 1.2;
      margin: 48px 0 8px 0;
      color: var(--foreground);
    }
    h2 {
      font-family: var(--font-editor-heading);
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.019em;
      line-height: 1.3;
      margin: 40px 0 8px 0;
      color: var(--foreground);
    }
    h3 {
      font-family: var(--font-editor-heading);
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.014em;
      line-height: 1.35;
      margin: 32px 0 6px 0;
      color: var(--foreground);
    }
    h4 {
      font-family: var(--font-editor-heading);
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.011em;
      line-height: 1.4;
      margin: 24px 0 6px 0;
      color: var(--foreground);
    }
    h5, h6 {
      font-family: var(--font-editor-heading);
      font-size: 18px;
      font-weight: 600;
      line-height: 1.5;
      margin: 20px 0 4px 0;
      color: var(--foreground);
    }

    /* Paragraphs */
    p {
      font-family: var(--font-editor-body);
      font-size: 16px;
      line-height: 1.65;
      margin: 0 0 8px 0;
      color: var(--foreground);
    }

    /* Links */
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Note Links - Wiki-style [[links]] */
    span[data-type="note-link"], .note-link {
      background: var(--accent);
      color: var(--accent-foreground);
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    /* Inline Code - Match editor */
    code {
      font-family: var(--font-mono);
      font-size: 0.875em;
      font-weight: 500;
      background: var(--muted);
      color: var(--foreground);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    /* Code Blocks - Light theme matching editor */
    pre, pre.hljs, div.code-block-wrapper pre, .content pre {
      font-family: var(--font-mono) !important;
      font-size: 14px !important;
      line-height: 1.7 !important;
      background: var(--code-bg) !important;
      color: var(--code-text) !important;
      padding: 24px !important;
      border-radius: 8px !important;
      border: 1px solid var(--border) !important;
      margin: 12px 0 !important;
      overflow-x: auto;
      -webkit-font-smoothing: auto;
    }
    pre code, pre.hljs code, .content pre code {
      font-family: var(--font-mono) !important;
      background: transparent !important;
      color: inherit !important;
      padding: 0 !important;
      border: none !important;
      font-size: inherit !important;
    }

    /* Syntax Highlighting - Light theme colors matching editor */
    .hljs { background: var(--code-bg); color: var(--code-text); }
    .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section { color: var(--code-keyword); font-weight: 500; }
    .hljs-string, .hljs-doctag, .hljs-meta-string { color: var(--code-string); }
    .hljs-number, .hljs-symbol, .hljs-bullet { color: var(--code-number); }
    .hljs-title, .hljs-title.function_, .hljs-title.class_ { color: var(--code-function); font-weight: 500; }
    .hljs-comment, .hljs-quote { color: var(--code-comment); font-style: italic; }
    .hljs-variable, .hljs-template-variable { color: #4a4a4a; }
    .hljs-type, .hljs-built_in { color: #b8860b; }
    .hljs-attr, .hljs-attribute { color: #9333ea; }
    .hljs-tag, .hljs-name { color: #0066cc; }
    .hljs-operator { color: #0891b2; }
    .hljs-punctuation { color: #737373; }

    /* Blockquotes */
    blockquote {
      font-family: var(--font-editor-body);
      font-size: 16px;
      line-height: 1.65;
      border-left: 4px solid var(--border);
      margin: 16px 0;
      padding: 0 0 0 16px;
      color: rgba(31, 31, 31, 0.7);
      font-style: italic;
    }
    blockquote p { margin: 0; }

    /* Lists - Match editor style */
    ul, ol {
      margin: 8px 0;
      padding-left: 0;
      list-style: none;
    }
    li {
      position: relative;
      margin: 2px 0;
      padding-left: 20px;
      font-family: var(--font-editor-body);
      font-size: 16px;
      line-height: 1.65;
    }

    /* Bullet points */
    ul > li::before {
      content: '';
      position: absolute;
      left: 1px;
      top: 0.55em;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(115, 115, 115, 0.5);
    }

    /* Numbered lists */
    ol { counter-reset: list-counter; }
    ol > li { counter-increment: list-counter; }
    ol > li::before {
      content: counter(list-counter) '.';
      position: absolute;
      left: 0;
      top: 0;
      font-size: 0.9em;
      color: rgba(115, 115, 115, 0.7);
      font-weight: 500;
    }

    /* Nested lists */
    li > ul, li > ol { margin: 4px 0 0 20px; }

    /* Task Lists - Logseq style */
    .task-list { list-style: none; padding-left: 0; }
    .task-item {
      display: grid;
      grid-template-columns: minmax(54px, auto) 1fr;
      align-items: start;
      gap: 10px;
      padding: 4px 10px;
      margin: 2px 0;
      border-radius: 10px;
    }
    .task-item::before { display: none; }
    .task-state-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      min-width: 50px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border-radius: 9999px;
      border: 1px solid var(--border);
      background: white;
      color: var(--muted-foreground);
      margin-top: 5px;
    }
    .task-item[data-state='done'] .task-state-button {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }
    .task-item[data-state='doing'] .task-state-button {
      background: rgba(0, 128, 255, 0.16);
      border-color: var(--primary);
      color: var(--primary);
    }
    .task-item[data-checked='true'] > div {
      text-decoration: line-through;
      color: var(--muted-foreground);
    }

    /* Tables - Match editor */
    table {
      width: 100%;
      margin: 12px 0;
      border-collapse: collapse;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 6px 12px;
      font-size: 0.95em;
      color: rgba(31, 31, 31, 0.9);
      background: white;
    }
    th {
      background: var(--muted);
      font-weight: 600;
      color: var(--muted-foreground);
      font-size: 0.9em;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
      box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 2px 4px;
    }

    /* Horizontal Rule */
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 24px 0;
    }

    /* Highlight */
    mark, .highlight-mark {
      background: var(--accent);
      color: var(--accent-foreground);
      padding: 0 4px;
      border-radius: 3px;
    }

    /* Strong and Emphasis */
    strong, b { font-weight: 600; color: var(--foreground); }
    em, i { font-style: italic; }
    del, s { color: var(--muted-foreground); text-decoration: line-through; }

    /* Mermaid Diagrams */
    .mermaid {
      background: rgba(255, 255, 255, 0.65);
      background-image:
        linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px);
      background-size: 20px 20px;
      padding: 24px;
      border-radius: 10px;
      margin: 16px 0;
      text-align: center;
      border: 1px solid var(--border);
    }
    .mermaid svg { max-width: 100%; height: auto; }

    /* Code block wrapper */
    .code-block-wrapper { position: relative; margin: 12px 0; }
    .code-block-wrapper pre { margin: 0; }

    /* Print styles */
    @media print {
      body { padding: 24px 36px; }
      pre { white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
      .mermaid { page-break-inside: avoid; }
      img { page-break-inside: avoid; }
      h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="doc-title">${escapeHtml(request.title || 'Untitled')}</div>
  <div class="prose content">
    ${request.content}
  </div>

  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>
    (async function() {
      // First, strip inline styles from code elements that might override our CSS
      document.querySelectorAll('pre, code, .code-block-wrapper').forEach((el) => {
        el.removeAttribute('style');
      });

      // Initialize Mermaid
      if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          flowchart: { curve: 'basis', padding: 20 },
          sequence: { actorMargin: 50, boxMargin: 10 },
        });
      }

      // Apply syntax highlighting to code blocks
      if (typeof hljs !== 'undefined') {
        document.querySelectorAll('pre code').forEach((block) => {
          // Skip mermaid blocks
          const lang = block.className.replace('language-', '');
          if (lang !== 'mermaid' && !block.closest('.mermaid')) {
            hljs.highlightElement(block);
          }
        });
      }

      // Convert mermaid code blocks to mermaid divs and render
      const mermaidBlocks = document.querySelectorAll(
        'pre code.language-mermaid, [data-language="mermaid"] code, pre code[class*="mermaid"]'
      );

      for (const block of mermaidBlocks) {
        const pre = block.closest('pre');
        const wrapper = block.closest('[data-language="mermaid"]') || pre?.closest('.code-block-wrapper');
        const parent = wrapper || pre;

        if (parent && parent.parentNode) {
          const mermaidDiv = document.createElement('div');
          mermaidDiv.className = 'mermaid';
          mermaidDiv.textContent = block.textContent || '';
          parent.parentNode.replaceChild(mermaidDiv, parent);
        }
      }

      // Also handle any existing pre tags with mermaid content
      document.querySelectorAll('pre').forEach((pre) => {
        const code = pre.querySelector('code');
        if (code && code.textContent) {
          const text = code.textContent.trim();
          // Check if content looks like mermaid (starts with common mermaid keywords)
          if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap|timeline)/i.test(text)) {
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = text;
            pre.parentNode.replaceChild(mermaidDiv, pre);
          }
        }
      });

      // Render mermaid diagrams
      if (typeof mermaid !== 'undefined') {
        try {
          await mermaid.run();
        } catch (e) {
          console.error('Mermaid error:', e);
        }
      }

      // Signal that we're ready
      window.exportReady = true;
    })();
  </script>
</body>
</html>`;

      try {
        // Write HTML to temp file
        await fs.writeFile(tempHtmlPath, htmlContent, 'utf-8');

        // Load from file:// protocol to allow CDN resources
        await printWindow.loadFile(tempHtmlPath);

        // Wait for scripts to load and render (check for ready signal)
        await new Promise<void>((resolve) => {
          let attempts = 0;
          const maxAttempts = 40; // 4 seconds max
          const checkReady = setInterval(async () => {
            attempts++;
            try {
              const ready = await printWindow.webContents.executeJavaScript('window.exportReady === true');
              if (ready || attempts >= maxAttempts) {
                clearInterval(checkReady);
                // Give a bit more time for final rendering
                setTimeout(resolve, 500);
              }
            } catch {
              if (attempts >= maxAttempts) {
                clearInterval(checkReady);
                resolve();
              }
            }
          }, 100);
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

  // Helper function to escape HTML
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
