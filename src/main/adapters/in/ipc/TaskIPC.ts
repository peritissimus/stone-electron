/**
 * Task IPC Adapter - Handles task/todo IPC channels
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { ITaskUseCases, TaskState } from '../../../domain';
import { handleIpcRequest } from './ipcUtils';
import { logger } from '../../../shared';

export interface TaskIPCDeps {
  taskUseCases: ITaskUseCases;
}

export function registerTaskHandlers(deps: TaskIPCDeps): void {
  const { taskUseCases } = deps;

  // Get all tasks from all notes
  ipcMain.handle(NOTE_CHANNELS.GET_ALL_TODOS, async () => {
    logger.info('[IPC] notes:getAllTodos');
    return handleIpcRequest(
      async () => {
        const tasks = await taskUseCases.getAllTasks.execute();
        return tasks.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }));
      },
      { loggerPrefix: NOTE_CHANNELS.GET_ALL_TODOS, defaultCode: 'TASK_ERROR' },
    );
  });

  // Get tasks for a specific note
  ipcMain.handle(NOTE_CHANNELS.GET_NOTE_TODOS, async (_, { noteId }: { noteId: string }) => {
    logger.info('[IPC] notes:getNoteTodos', { noteId });
    return handleIpcRequest(
      async () => {
        const tasks = await taskUseCases.getNoteTasks.execute(noteId);
        return tasks.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }));
      },
      { loggerPrefix: 'notes:getNoteTodos', defaultCode: 'TASK_ERROR' },
    );
  });

  // Update task state
  ipcMain.handle(
    NOTE_CHANNELS.UPDATE_TASK_STATE,
    async (
      _,
      { noteId, taskIndex, newState }: { noteId: string; taskIndex: number; newState: TaskState },
    ) => {
      logger.info('[IPC] notes:updateTaskState', { noteId, taskIndex, newState });
      return handleIpcRequest(
        async () => {
          await taskUseCases.updateTaskState.execute(noteId, taskIndex, newState);
          return { success: true };
        },
        { loggerPrefix: NOTE_CHANNELS.UPDATE_TASK_STATE, defaultCode: 'TASK_ERROR' },
      );
    },
  );

  // Toggle task
  ipcMain.handle(
    NOTE_CHANNELS.TOGGLE_TASK,
    async (_, { noteId, taskIndex }: { noteId: string; taskIndex: number }) => {
      logger.info('[IPC] notes:toggleTask', { noteId, taskIndex });
      return handleIpcRequest(
        async () => {
          await taskUseCases.toggleTask.execute(noteId, taskIndex);
          return { success: true };
        },
        { loggerPrefix: 'notes:toggleTask', defaultCode: 'TASK_ERROR' },
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
