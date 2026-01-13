/**
 * Notebook API - IPC channel wrappers for notebook operations
 *
 * Implements: specs/api.ts#NotebookAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { NOTEBOOK_CHANNELS } from '@shared/constants/ipcChannels';
import type { Notebook, IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import { NotebookSchema, NotebookWithCountSchema } from './schemas';

export interface NotebookWithCount extends Notebook {
  note_count: number;
  children?: NotebookWithCount[];
}

export interface GetAllNotebooksParams {
  include_counts?: boolean;
  flat?: boolean;
}

export const notebookAPI = {
  /**
   * Get all notebooks
   */
  getAll: async (
    params?: GetAllNotebooksParams,
  ): Promise<IpcResponse<{ notebooks: NotebookWithCount[] }>> => {
    const response = await invokeIpc(NOTEBOOK_CHANNELS.GET_ALL, params);
    return validateResponse(response, z.object({ notebooks: z.array(NotebookWithCountSchema) }));
  },

  /**
   * Create a new notebook
   */
  create: async (data: {
    name: string;
    parent_id?: string;
    icon?: string;
    color?: string;
  }): Promise<IpcResponse<Notebook>> => {
    const response = await invokeIpc(NOTEBOOK_CHANNELS.CREATE, data);
    return validateResponse(response, NotebookSchema);
  },

  /**
   * Update an existing notebook
   */
  update: async (
    id: string,
    data: Partial<{
      name: string;
      icon: string;
      color: string;
    }>,
  ): Promise<IpcResponse<Notebook>> => {
    const response = await invokeIpc(NOTEBOOK_CHANNELS.UPDATE, { id, ...data });
    return validateResponse(response, NotebookSchema);
  },

  /**
   * Delete a notebook
   */
  delete: async (id: string, deleteNotes?: boolean): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(NOTEBOOK_CHANNELS.DELETE, { id, delete_notes: deleteNotes });
    return validateResponse(response, z.void());
  },

  /**
   * Move a notebook to a new parent or position
   */
  move: async (id: string, parentId?: string, position?: number): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(NOTEBOOK_CHANNELS.MOVE, {
      id,
      parent_id: parentId,
      position,
    });
    return validateResponse(response, z.void());
  },
};
