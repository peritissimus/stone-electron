/**
 * Task IPC Adapter - Handles task/todo IPC channels
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { ITaskUseCases, TaskState } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface TaskIPCDeps {
  taskUseCases: ITaskUseCases;
}

export function registerTaskHandlers(deps: TaskIPCDeps): void {
  const { taskUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'TaskIPC', defaultCode: 'TASK_ERROR', context });

  // Get all tasks from all notes
  ipcMain.handle(NOTE_CHANNELS.GET_ALL_TODOS, async () => {
    return handleRequest(
      async () => {
        const tasks = await taskUseCases.getAllTasks.execute();
        return tasks.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }));
      },
      { channel: NOTE_CHANNELS.GET_ALL_TODOS },
    );
  });

  // Get tasks for a specific note
  ipcMain.handle(NOTE_CHANNELS.GET_NOTE_TODOS, async (_, { noteId }: { noteId: string }) => {
    return handleRequest(
      async () => {
        const tasks = await taskUseCases.getNoteTasks.execute(noteId);
        return tasks.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }));
      },
      { channel: NOTE_CHANNELS.GET_NOTE_TODOS, noteId },
    );
  });

  // Update task state
  ipcMain.handle(
    NOTE_CHANNELS.UPDATE_TASK_STATE,
    async (
      _,
      { noteId, taskIndex, newState }: { noteId: string; taskIndex: number; newState: TaskState },
    ) => {
      return handleRequest(
        async () => {
          await taskUseCases.updateTaskState.execute(noteId, taskIndex, newState);
          return { success: true };
        },
        { channel: NOTE_CHANNELS.UPDATE_TASK_STATE, noteId, taskIndex, newState },
      );
    },
  );

  // Toggle task
  ipcMain.handle(
    NOTE_CHANNELS.TOGGLE_TASK,
    async (_, { noteId, taskIndex }: { noteId: string; taskIndex: number }) => {
      return handleRequest(
        async () => {
          await taskUseCases.toggleTask.execute(noteId, taskIndex);
          return { success: true };
        },
        { channel: NOTE_CHANNELS.TOGGLE_TASK, noteId, taskIndex },
      );
    },
  );

  logger.info('[IPC] Task handlers registered');
}

export function unregisterTaskHandlers(): void {
  ipcMain.removeHandler(NOTE_CHANNELS.GET_ALL_TODOS);
  ipcMain.removeHandler(NOTE_CHANNELS.GET_NOTE_TODOS);
  ipcMain.removeHandler(NOTE_CHANNELS.UPDATE_TASK_STATE);
  ipcMain.removeHandler(NOTE_CHANNELS.TOGGLE_TASK);
}
