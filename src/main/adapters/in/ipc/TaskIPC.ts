/**
 * Task IPC Adapter - Handles task/todo IPC channels
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  NoteIdRequestSchema,
  ToggleTaskRequestSchema,
  UpdateTaskStateRequestSchema,
} from '@shared/schemas';
import type { ITaskUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface TaskIPCDeps {
  runTaskEffect: RunTaskEffect;
}

export type RunTaskEffect = <A, E>(
  use: (service: ITaskUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerTaskHandlers(deps: TaskIPCDeps): void {
  const run = deps.runTaskEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'TaskIPC', defaultCode: 'TASK_ERROR', context });

  // Get all tasks from all notes
  ipcMain.handle(NOTE_CHANNELS.GET_ALL_TODOS, async () => {
    return handleRequest(
      async () => {
        const tasks = await run((service) =>
          service.getAllTasks.execute(),
        );
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
  ipcMain.handle(NOTE_CHANNELS.GET_NOTE_TODOS, async (_, rawRequest) => {
    const { noteId } = NoteIdRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        const tasks = await run((service) =>
          service.getNoteTasks.execute(noteId),
        );
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
    async (_, rawRequest) => {
      const { noteId, taskIndex, newState } = UpdateTaskStateRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          await run((service) =>
            service.updateTaskState.execute(noteId, taskIndex, newState),
          );
          return { success: true };
        },
        { channel: NOTE_CHANNELS.UPDATE_TASK_STATE, noteId, taskIndex, newState },
      );
    },
  );

  // Toggle task
  ipcMain.handle(
    NOTE_CHANNELS.TOGGLE_TASK,
    async (_, rawRequest) => {
      const { noteId, taskIndex } = ToggleTaskRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          await run((service) =>
            service.toggleTask.execute(noteId, taskIndex),
          );
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
