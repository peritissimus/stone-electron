/**
 * Task Use Cases - Orchestration for task/todo operations
 */

import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type {
  ITaskUseCases,
  IGetAllTasksUseCase,
  IGetNoteTasksUseCase,
  IUpdateTaskStateUseCase,
  IToggleTaskUseCase,
  TaskItem,
} from '../../../domain/ports/in/ITaskUseCases';
import { TaskExtractor, type TaskState } from '../../../domain/services/TaskExtractor';
import { NoteEntity } from '../../../domain/entities/Note';
import { logger } from '../../../shared/utils';
import path from 'node:path';

/**
 * Dependencies for task use cases
 */
export interface TaskUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
}

/**
 * Get all tasks from all notes
 */
class GetAllTasksUseCase implements IGetAllTasksUseCase {
  constructor(private deps: TaskUseCasesDeps) {}

  async execute(): Promise<TaskItem[]> {
    const { noteRepository, workspaceRepository, fileStorage, markdownProcessor } = this.deps;

    // Get active workspace
    const activeWorkspace = await workspaceRepository.findActive();
    if (!activeWorkspace) {
      logger.warn('[TaskUseCases] No active workspace found');
      return [];
    }

    // Get non-deleted notes for active workspace only
    const notes = await noteRepository.findAll({
      workspaceId: activeWorkspace.id,
      isDeleted: false,
    });

    logger.info(`[TaskUseCases] Scanning ${notes.length} notes for tasks`);

    const tasks: TaskItem[] = [];

    for (const note of notes) {
      try {
        if (!note.filePath || !note.workspaceId) continue;

        // Get workspace to build absolute path
        const workspace = await workspaceRepository.findById(note.workspaceId);
        if (!workspace) continue;

        const absolutePath = path.join(workspace.folderPath, note.filePath);

        // Read raw markdown content
        const markdown = await fileStorage.read(absolutePath);
        if (!markdown) continue;

        // Extract tasks using domain service
        const rawTasks = TaskExtractor.extractTasks(markdown);

        // Map to TaskItems with note metadata
        for (const rawTask of rawTasks) {
          tasks.push({
            id: `${note.id}-${rawTask.index}`,
            noteId: note.id,
            noteTitle: note.title,
            notePath: note.filePath,
            text: rawTask.text,
            state: rawTask.state,
            checked: rawTask.checked,
            lineNumber: rawTask.lineNumber,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          });
        }
      } catch (error) {
        // Skip notes with read errors
        logger.debug(`[TaskUseCases] Skipping note ${note.id}: ${error}`);
      }
    }

    logger.info(`[TaskUseCases] Found ${tasks.length} tasks`);
    return tasks;
  }
}

/**
 * Get tasks for a specific note
 */
class GetNoteTasksUseCase implements IGetNoteTasksUseCase {
  constructor(private deps: TaskUseCasesDeps) {}

  async execute(noteId: string): Promise<TaskItem[]> {
    const { noteRepository, workspaceRepository, fileStorage } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    if (!note.filePath || !note.workspaceId) {
      return [];
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const markdown = await fileStorage.read(absolutePath);
    if (!markdown) {
      return [];
    }

    const rawTasks = TaskExtractor.extractTasks(markdown);

    return rawTasks.map((rawTask) => ({
      id: `${note.id}-${rawTask.index}`,
      noteId: note.id,
      noteTitle: note.title,
      notePath: note.filePath,
      text: rawTask.text,
      state: rawTask.state,
      checked: rawTask.checked,
      lineNumber: rawTask.lineNumber,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));
  }
}

/**
 * Update a task's state
 */
class UpdateTaskStateUseCase implements IUpdateTaskStateUseCase {
  constructor(private deps: TaskUseCasesDeps) {}

  async execute(noteId: string, taskIndex: number, newState: TaskState): Promise<void> {
    const { noteRepository, workspaceRepository, fileStorage } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    if (!note.filePath || !note.workspaceId) {
      throw new Error('Note has no file path');
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const absolutePath = path.join(workspace.folderPath, note.filePath);
    const markdown = await fileStorage.read(absolutePath);
    if (!markdown) {
      throw new Error('Could not read note content');
    }

    // Use domain service to replace task state
    const updatedMarkdown = TaskExtractor.replaceTaskState(markdown, taskIndex, newState);

    // Write back to file (preserving title heading)
    const titleHeading = `# ${note.title}\n\n`;
    const contentWithTitle = titleHeading + updatedMarkdown.replace(/^#\s+.*\n\n?/, '');

    await fileStorage.write(absolutePath, contentWithTitle);

    // Update note timestamp - reconstruct entity from props
    const noteEntity = NoteEntity.fromPersistence(note);
    await noteRepository.save(noteEntity);

    logger.info(`[TaskUseCases] Updated task ${taskIndex} in note ${noteId} to ${newState}`);
  }
}

/**
 * Toggle a task between TODO and DONE
 */
class ToggleTaskUseCase implements IToggleTaskUseCase {
  constructor(
    private deps: TaskUseCasesDeps,
    private getNoteTasks: IGetNoteTasksUseCase,
    private updateTaskState: IUpdateTaskStateUseCase,
  ) {}

  async execute(noteId: string, taskIndex: number): Promise<void> {
    const tasks = await this.getNoteTasks.execute(noteId);
    const task = tasks.find((t) => t.id === `${noteId}-${taskIndex}`);

    if (!task) {
      throw new Error(`Task at index ${taskIndex} not found`);
    }

    const newState: TaskState = task.state === 'done' ? 'todo' : 'done';
    await this.updateTaskState.execute(noteId, taskIndex, newState);
  }
}

/**
 * Create task use cases
 */
export function createTaskUseCases(deps: TaskUseCasesDeps): ITaskUseCases {
  const getAllTasks = new GetAllTasksUseCase(deps);
  const getNoteTasks = new GetNoteTasksUseCase(deps);
  const updateTaskState = new UpdateTaskStateUseCase(deps);
  const toggleTask = new ToggleTaskUseCase(deps, getNoteTasks, updateTaskState);

  return {
    getAllTasks,
    getNoteTasks,
    updateTaskState,
    toggleTask,
  };
}
