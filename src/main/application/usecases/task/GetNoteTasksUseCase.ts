import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type {
  IGetNoteTasksUseCase,
  TaskItem,
} from '../../../domain/ports/in/ITaskUseCases';
import { TaskExtractor } from '../../../domain/services/TaskExtractor';

export interface GetNoteTasksUseCaseDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  pathService: IPathService;
}

/**
 * Get tasks for a specific note
 */
export class GetNoteTasksUseCase implements IGetNoteTasksUseCase {
  constructor(private deps: GetNoteTasksUseCaseDeps) {}

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

    const absolutePath = this.deps.pathService.join(workspace.folderPath, note.filePath);
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
