import path from 'node:path';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type {
  IGetAllTasksUseCase,
  TaskItem,
} from '../../../domain/ports/in/ITaskUseCases';
import { TaskExtractor } from '../../../domain/services/TaskExtractor';
import { logger } from '../../../shared/utils';

export interface GetAllTasksUseCaseDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
}

/**
 * Get all tasks from all notes
 */
export class GetAllTasksUseCase implements IGetAllTasksUseCase {
  constructor(private deps: GetAllTasksUseCaseDeps) {}

  async execute(): Promise<TaskItem[]> {
    const { noteRepository, workspaceRepository, fileStorage } = this.deps;

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
