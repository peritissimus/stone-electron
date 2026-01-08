/**
 * Task Use Case Ports - Inbound interfaces for task operations
 */

import type { TaskState } from '../../services/TaskExtractor';

/**
 * Task item with full metadata
 */
export interface TaskItem {
  id: string;
  noteId: string;
  noteTitle: string | null;
  notePath: string | null;
  text: string;
  state: TaskState;
  checked: boolean;
  lineNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all tasks from all notes
 */
export interface IGetAllTasksUseCase {
  execute(): Promise<TaskItem[]>;
}

/**
 * Get tasks for a specific note
 */
export interface IGetNoteTasksUseCase {
  execute(noteId: string): Promise<TaskItem[]>;
}

/**
 * Update a task's state
 */
export interface IUpdateTaskStateUseCase {
  execute(noteId: string, taskIndex: number, newState: TaskState): Promise<void>;
}

/**
 * Toggle a task between TODO and DONE
 */
export interface IToggleTaskUseCase {
  execute(noteId: string, taskIndex: number): Promise<void>;
}

/**
 * Aggregated task use cases
 */
export interface ITaskUseCases {
  getAllTasks: IGetAllTasksUseCase;
  getNoteTasks: IGetNoteTasksUseCase;
  updateTaskState: IUpdateTaskStateUseCase;
  toggleTask: IToggleTaskUseCase;
}
