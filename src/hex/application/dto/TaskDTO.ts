/**
 * Task DTOs - Data transfer objects for task operations
 */

import type { TaskState } from '../../domain/services/TaskExtractor';

/**
 * Task item response
 */
export interface TaskDTO {
  id: string;
  noteId: string;
  noteTitle: string | null;
  notePath: string | null;
  text: string;
  state: TaskState;
  checked: boolean;
  lineNumber: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all tasks response
 */
export interface GetAllTasksResponseDTO {
  tasks: TaskDTO[];
  total: number;
}

/**
 * Get note tasks request
 */
export interface GetNoteTasksRequestDTO {
  noteId: string;
}

/**
 * Update task state request
 */
export interface UpdateTaskStateRequestDTO {
  noteId: string;
  taskIndex: number;
  newState: TaskState;
}

/**
 * Toggle task request
 */
export interface ToggleTaskRequestDTO {
  noteId: string;
  taskIndex: number;
}
