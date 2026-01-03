/**
 * Note API - IPC channel wrappers for note operations
 *
 * Implements: specs/api.ts#NoteAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { Note, IpcResponse, TodoItem } from '@shared/types';
import type { NoteFilters, GraphData as SpecGraphData } from '@/specs';

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
  getAll: (params?: GetAllNotesParams): Promise<IpcResponse<{ notes: NoteWithMeta[] }>> =>
    invokeIpc(NOTE_CHANNELS.GET_ALL, params),

  /**
   * Get a single note by ID
   */
  getById: (id: string): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.GET, { id }),

  /**
   * Get a note by its file path
   */
  getByPath: (path: string): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.GET_BY_PATH, { path }),

  /**
   * Get note content (lazy load from file)
   */
  getContent: (id: string): Promise<IpcResponse<{ content: string }>> =>
    invokeIpc(NOTE_CHANNELS.GET_CONTENT, { id }),

  /**
   * Create a new note
   */
  create: (data: {
    title: string;
    content?: string;
    notebookId?: string;
    folderPath?: string;
  }): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.CREATE, data),

  /**
   * Update an existing note
   */
  update: (
    id: string,
    data: Partial<{
      title: string;
      content: string;
      notebookId: string;
    }>,
    silent?: boolean
  ): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.UPDATE, { id, ...data, silent }),

  /**
   * Delete a note
   */
  delete: (id: string): Promise<IpcResponse<void>> =>
    invokeIpc(NOTE_CHANNELS.DELETE, { id }),

  /**
   * Move a note to a different location
   */
  move: (id: string, targetPath: string): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.MOVE, { id, targetPath }),

  /**
   * Toggle favorite status
   */
  favorite: (id: string, favorite: boolean): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.FAVORITE, { id, favorite }),

  /**
   * Toggle pin status
   */
  pin: (id: string, pinned: boolean): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.PIN, { id, pinned }),

  /**
   * Toggle archive status
   */
  archive: (id: string, archived: boolean): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.ARCHIVE, { id, archived }),

  /**
   * Get all todos across all notes
   */
  getAllTodos: (): Promise<IpcResponse<TodoItem[]>> =>
    invokeIpc(NOTE_CHANNELS.GET_ALL_TODOS, {}),

  /**
   * Update a task state in a note
   */
  updateTaskState: (
    noteId: string,
    taskIndex: number,
    newState: string
  ): Promise<IpcResponse<void>> =>
    invokeIpc(NOTE_CHANNELS.UPDATE_TASK_STATE, { noteId, taskIndex, newState }),

  /**
   * Get note versions
   */
  getVersions: (id: string): Promise<IpcResponse<{ versions: unknown[] }>> =>
    invokeIpc(NOTE_CHANNELS.GET_VERSIONS, { id }),

  /**
   * Restore a note version
   */
  restoreVersion: (id: string, versionId: string): Promise<IpcResponse<Note>> =>
    invokeIpc(NOTE_CHANNELS.RESTORE_VERSION, { id, versionId }),

  /**
   * Get notes that link to this note
   */
  getBacklinks: (id: string): Promise<IpcResponse<{ notes: Note[] }>> =>
    invokeIpc(NOTE_CHANNELS.GET_BACKLINKS, { id }),

  /**
   * Get notes that this note links to
   */
  getForwardLinks: (id: string): Promise<IpcResponse<{ notes: Note[] }>> =>
    invokeIpc(NOTE_CHANNELS.GET_FORWARD_LINKS, { id }),

  /**
   * Get graph data for visualization
   */
  getGraphData: (): Promise<IpcResponse<GraphData>> =>
    invokeIpc(NOTE_CHANNELS.GET_GRAPH_DATA, {}),

  /**
   * Export note as HTML
   */
  exportHtml: (id: string): Promise<IpcResponse<{ html: string; path: string }>> =>
    invokeIpc(NOTE_CHANNELS.EXPORT_HTML, { id }),

  /**
   * Export note as PDF
   */
  exportPdf: (id: string): Promise<IpcResponse<{ path: string }>> =>
    invokeIpc(NOTE_CHANNELS.EXPORT_PDF, { id }),

  /**
   * Export note as Markdown
   */
  exportMarkdown: (id: string): Promise<IpcResponse<{ markdown: string; path: string }>> =>
    invokeIpc(NOTE_CHANNELS.EXPORT_MARKDOWN, { id }),
};
