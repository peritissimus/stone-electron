/**
 * Task IPC Adapter - Handles task/todo IPC channels
 */

import { ipcMain } from 'electron';
import type { ITaskUseCases } from '../../../domain/ports/in/ITaskUseCases';
import type { TaskState } from '../../../domain/services/TaskExtractor';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  GET_ALL: 'notes:getAllTodos',
  GET_NOTE_TASKS: 'notes:getNoteTodos',
  UPDATE_STATE: 'notes:updateTaskState',
  TOGGLE: 'notes:toggleTask',
} as const;

export interface TaskIPCDeps {
  taskUseCases: ITaskUseCases;
}

export function registerTaskHandlers(deps: TaskIPCDeps): void {
  const { taskUseCases } = deps;

  // Get all tasks from all notes
  ipcMain.handle(CHANNELS.GET_ALL, async () => {
    try {
      logger.info('[IPC] notes:getAllTodos');
      const tasks = await taskUseCases.getAllTasks.execute();
      return {
        success: true,
        data: {
          tasks: tasks.map((t) => ({
            ...t,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          })),
          total: tasks.length,
        },
      };
    } catch (error) {
      logger.error('[IPC] notes:getAllTodos error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get tasks for a specific note
  ipcMain.handle(CHANNELS.GET_NOTE_TASKS, async (_, noteId: string) => {
    try {
      logger.info('[IPC] notes:getNoteTodos', { noteId });
      const tasks = await taskUseCases.getNoteTasks.execute(noteId);
      return {
        success: true,
        data: tasks.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      };
    } catch (error) {
      logger.error('[IPC] notes:getNoteTodos error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Update task state
  ipcMain.handle(
    CHANNELS.UPDATE_STATE,
    async (_, noteId: string, taskIndex: number, newState: TaskState) => {
      try {
        logger.info('[IPC] notes:updateTaskState', { noteId, taskIndex, newState });
        await taskUseCases.updateTaskState.execute(noteId, taskIndex, newState);
        return { success: true };
      } catch (error) {
        logger.error('[IPC] notes:updateTaskState error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Toggle task
  ipcMain.handle(CHANNELS.TOGGLE, async (_, noteId: string, taskIndex: number) => {
    try {
      logger.info('[IPC] notes:toggleTask', { noteId, taskIndex });
      await taskUseCases.toggleTask.execute(noteId, taskIndex);
      return { success: true };
    } catch (error) {
      logger.error('[IPC] notes:toggleTask error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('[IPC] Task handlers registered');
}

export function unregisterTaskHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
