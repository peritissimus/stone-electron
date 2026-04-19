import path from 'node:path';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IUpdateTaskStateUseCase } from '../../../domain/ports/in/ITaskUseCases';
import { TaskExtractor, type TaskState } from '../../../domain/services/TaskExtractor';
import { NoteEntity } from '../../../domain/entities/Note';
import { logger } from '../../../shared/utils';

export interface UpdateTaskStateUseCaseDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

/**
 * Update a task's state
 */
export class UpdateTaskStateUseCase implements IUpdateTaskStateUseCase {
  constructor(private deps: UpdateTaskStateUseCaseDeps) {}

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
