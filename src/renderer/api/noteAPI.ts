/**
 * Note API - IPC channel wrappers for note operations
 *
 * Implements: specs/api.ts#NoteAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { Note, IpcResponse, TodoItem } from '@shared/types';
import type { NoteFilters, GraphData as SpecGraphData } from '@renderer/specs';
import {
  ExportHtmlResponseSchema,
  ExportMarkdownResponseSchema,
  ExportPdfResponseSchema,
  GetAllNotesResponseSchema,
  GetLinksResponseSchema,
  GetNoteContentResponseSchema,
  GetVersionsResponseSchema,
} from '@shared/schemas';
import { validateResponse } from './validation';
import { NoteSchema, TodoItemSchema, GraphDataSchema } from './schemas';

// Re-export types aligned with specs
export type GetAllNotesParams = NoteFilters;

export interface NoteWithMeta extends Note {
  tags?: Array<{ id: string; name: string; color: string | null }>;
  topics?: Array<{ id: string; name: string; color: string | null; confidence: number }>;
}

// GraphData matches specs/entities.ts#GraphData
export interface GraphData extends SpecGraphData {}

export const noteAPI = {
  /**
   * Get all notes with optional filtering
   */
  getAll: async (
    params?: GetAllNotesParams,
  ): Promise<IpcResponse<{ notes: NoteWithMeta[] }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_ALL, params);
    return validateResponse(response, GetAllNotesResponseSchema);
  },

  /**
   * Get a single note by ID
   */
  getById: async (id: string): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET, { id });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Get a note by its file path
   */
  getByPath: async (path: string): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_BY_PATH, { path });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Get note content (lazy load from file)
   */
  getContent: async (id: string): Promise<IpcResponse<{ content: string }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_CONTENT, { id });
    return validateResponse(response, GetNoteContentResponseSchema);
  },

  /**
   * Create a new note
   */
  create: async (data: {
    title: string;
    content?: string;
    notebookId?: string;
    folderPath?: string;
  }): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.CREATE, data);
    return validateResponse(response, NoteSchema);
  },

  /**
   * Update an existing note
   */
  update: async (
    id: string,
    data: Partial<{
      title: string;
      content: string;
      notebookId: string;
    }>,
    silent?: boolean,
  ): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.UPDATE, { id, ...data, silent });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Delete a note
   */
  delete: async (id: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(NOTE_CHANNELS.DELETE, { id });
    return validateResponse(response, z.void());
  },

  /**
   * Move a note to a different location
   */
  move: async (id: string, targetPath: string): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.MOVE, { id, targetPath });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Toggle favorite status
   */
  favorite: async (id: string, favorite: boolean): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.FAVORITE, { id, favorite });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Toggle pin status
   */
  pin: async (id: string, pinned: boolean): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.PIN, { id, pinned });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Toggle archive status
   */
  archive: async (id: string, archived: boolean): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.ARCHIVE, { id, archived });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Get all todos across all notes
   */
  getAllTodos: async (): Promise<IpcResponse<TodoItem[]>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_ALL_TODOS, {});
    return validateResponse(response, z.array(TodoItemSchema));
  },

  /**
   * Update a task state in a note
   */
  updateTaskState: async (
    noteId: string,
    taskIndex: number,
    newState: string,
  ): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(NOTE_CHANNELS.UPDATE_TASK_STATE, {
      noteId,
      taskIndex,
      newState,
    });
    return validateResponse(response, z.void());
  },

  /**
   * Get note versions
   */
  getVersions: async (id: string): Promise<IpcResponse<{ versions: unknown[] }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_VERSIONS, { id });
    return validateResponse(response, GetVersionsResponseSchema);
  },

  /**
   * Restore a note version
   */
  restoreVersion: async (id: string, versionId: string): Promise<IpcResponse<Note>> => {
    const response = await invokeIpc(NOTE_CHANNELS.RESTORE_VERSION, { id, versionId });
    return validateResponse(response, NoteSchema);
  },

  /**
   * Get notes that link to this note
   */
  getBacklinks: async (id: string): Promise<IpcResponse<{ notes: Note[] }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_BACKLINKS, { id });
    return validateResponse(response, GetLinksResponseSchema) as IpcResponse<{ notes: Note[] }>;
  },

  /**
   * Get notes that this note links to
   */
  getForwardLinks: async (id: string): Promise<IpcResponse<{ notes: Note[] }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_FORWARD_LINKS, { id });
    return validateResponse(response, GetLinksResponseSchema) as IpcResponse<{ notes: Note[] }>;
  },

  /**
   * Get graph data for visualization
   */
  getGraphData: async (options?: {
    centerNoteId?: string;
    depth?: number;
    includeOrphans?: boolean;
  }): Promise<IpcResponse<GraphData>> => {
    const response = await invokeIpc(NOTE_CHANNELS.GET_GRAPH_DATA, {
      includeOrphans: true,
      ...options,
    });
    return validateResponse(response, GraphDataSchema);
  },

  /**
   * Export note as HTML
   * @param id - Note ID
   * @param renderedHtml - Pre-rendered HTML content (includes fonts, diagrams, and styles)
   * @param title - Note title for filename
   */
  exportHtml: async (
    id: string,
    renderedHtml?: string,
    title?: string,
  ): Promise<IpcResponse<{ html: string; path: string }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.EXPORT_HTML, {
      id,
      renderedHtml,
      title,
    });
    return validateResponse(response, ExportHtmlResponseSchema);
  },

  /**
   * Export note as PDF
   * @param id - Note ID
   * @param renderedHtml - Pre-rendered HTML content from the editor (with diagrams, styles, etc.)
   * @param title - Note title for filename
   */
  exportPdf: async (
    id: string,
    renderedHtml?: string,
    title?: string,
  ): Promise<IpcResponse<{ path: string }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.EXPORT_PDF, {
      id,
      renderedHtml,
      title,
    });
    return validateResponse(response, ExportPdfResponseSchema);
  },

  /**
   * Export note as Markdown
   */
  exportMarkdown: async (
    id: string,
  ): Promise<IpcResponse<{ markdown: string; path: string }>> => {
    const response = await invokeIpc(NOTE_CHANNELS.EXPORT_MARKDOWN, { id });
    return validateResponse(response, ExportMarkdownResponseSchema);
  },
};
