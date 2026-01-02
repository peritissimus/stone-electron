/**
 * TaskService - Task management for notes
 *
 * Handles extracting and updating Logseq-style task patterns from markdown files.
 * Supported states: TODO, DOING, DONE, WAITING, HOLD, CANCELED, IDEA
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getRepositories } from '../repositories';
import { getNoteService } from './NoteService';
import { logger } from '../utils/logger';

export interface TodoItem {
  id: string;
  noteId: string;
  noteTitle: string | null;
  notePath: string | null;
  text: string;
  state: string;
  checked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskState = 'todo' | 'doing' | 'done' | 'waiting' | 'hold' | 'canceled' | 'idea';

const VALID_STATES = new Set<TaskState>([
  'todo',
  'doing',
  'done',
  'waiting',
  'hold',
  'canceled',
  'idea',
]);

/**
 * TaskService handles task extraction and updates
 */
class TaskService {
  // Task pattern for Logseq-style tasks
  private static readonly TASK_PATTERN =
    /^(\s*)(?:[-*]\s+)?(TODO|DOING|DONE|WAITING|HOLD|CANCELED|CANCELLED|IDEA)\s+(.+)$/gim;

  // ==========================================================================
  // Task Queries
  // ==========================================================================

  /**
   * Get all todos from all notes
   * Scans markdown files directly for task patterns
   */
  async getAllTodos(): Promise<TodoItem[]> {
    const repos = getRepositories();
    const noteService = getNoteService();

    const notes = await repos.note.findAll({ where: { isDeleted: false } });
    logger.info(`[TaskService] Scanning ${notes.length} notes for tasks`);

    const todos: TodoItem[] = [];

    for (const note of notes) {
      try {
        // Get raw markdown content (not HTML)
        const content = await noteService.getRawContent(note.id);
        if (!content) continue;

        // Find all task lines in the markdown
        const noteTasks = this.extractTasksFromContent(content, note);
        todos.push(...noteTasks);
      } catch {
        // Silently skip notes with missing files
      }
    }

    logger.info(`[TaskService] Found ${todos.length} tasks`);
    return todos;
  }

  /**
   * Get todos for a specific note
   */
  async getTodosForNote(noteId: string): Promise<TodoItem[]> {
    const repos = getRepositories();
    const noteService = getNoteService();

    const note = await repos.note.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const content = await noteService.getRawContent(noteId);
    if (!content) {
      return [];
    }

    return this.extractTasksFromContent(content, note);
  }

  // ==========================================================================
  // Task Updates
  // ==========================================================================

  /**
   * Update a task's state in a note's markdown file
   */
  async updateTaskState(
    noteId: string,
    taskIndex: number,
    newState: TaskState,
  ): Promise<void> {
    const repos = getRepositories();
    const noteService = getNoteService();

    // Validate state
    const normalizedState = newState.toLowerCase() as TaskState;
    if (!VALID_STATES.has(normalizedState)) {
      throw new Error(`Invalid task state: ${newState}`);
    }

    // Get raw markdown content
    const content = await noteService.getRawContent(noteId);
    if (!content) {
      throw new Error('Note content not found');
    }

    // Find and replace the task at the specified index
    let currentIndex = 0;
    let found = false;

    const newContent = content.replace(
      TaskService.TASK_PATTERN,
      (match, indent, listMarker, _state, text) => {
        if (currentIndex === taskIndex) {
          found = true;
          const prefix = listMarker || '- ';
          currentIndex++;
          return `${indent}${prefix}${normalizedState.toUpperCase()} ${text}`;
        }
        currentIndex++;
        return match;
      },
    );

    if (!found) {
      throw new Error(`Task at index ${taskIndex} not found`);
    }

    // Get note and workspace info
    const note = await repos.note.findById(noteId);
    if (!note?.filePath || !note?.workspaceId) {
      throw new Error('Note file path not found');
    }

    const workspace = await repos.workspace.findById(note.workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Write back to file with title heading
    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const titleHeading = `# ${note.title}\n\n`;
    const contentWithTitle = titleHeading + newContent;

    await fs.writeFile(absolutePath, contentWithTitle, 'utf-8');

    // Update note timestamp
    await repos.note.update(noteId, { updatedAt: new Date() });

    logger.info(`[TaskService] Updated task ${taskIndex} in note ${noteId} to ${normalizedState}`);
  }

  /**
   * Toggle a task between TODO and DONE
   */
  async toggleTask(noteId: string, taskIndex: number): Promise<void> {
    const todos = await this.getTodosForNote(noteId);
    const task = todos[taskIndex];

    if (!task) {
      throw new Error(`Task at index ${taskIndex} not found`);
    }

    const newState: TaskState = task.state === 'done' ? 'todo' : 'done';
    await this.updateTaskState(noteId, taskIndex, newState);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Extract tasks from markdown content
   */
  private extractTasksFromContent(
    content: string,
    note: { id: string; title: string | null; filePath: string | null; createdAt: Date; updatedAt: Date },
  ): TodoItem[] {
    const todos: TodoItem[] = [];
    const pattern = new RegExp(TaskService.TASK_PATTERN.source, TaskService.TASK_PATTERN.flags);

    let match;
    let index = 0;

    while ((match = pattern.exec(content)) !== null) {
      const stateRaw = match[2].toLowerCase();
      const state = stateRaw === 'cancelled' ? 'canceled' : stateRaw;
      const text = match[3].trim();
      const isDone = state === 'done' || state === 'canceled';

      if (text) {
        todos.push({
          id: `${note.id}-${index}`,
          noteId: note.id,
          noteTitle: note.title,
          notePath: note.filePath,
          text,
          state,
          checked: isDone,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        });
        index++;
      }
    }

    return todos;
  }
}

// Singleton instance
let instance: TaskService | null = null;

export function getTaskService(): TaskService {
  instance ??= new TaskService();
  return instance;
}
