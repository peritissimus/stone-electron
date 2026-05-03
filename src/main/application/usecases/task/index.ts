import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { ITaskUseCases } from '../../../domain/ports/in/ITaskUseCases';
import { GetAllTasksUseCase } from './GetAllTasksUseCase';
import { GetNoteTasksUseCase } from './GetNoteTasksUseCase';
import { UpdateTaskStateUseCase } from './UpdateTaskStateUseCase';
import { ToggleTaskUseCase } from './ToggleTaskUseCase';

export { GetAllTasksUseCase } from './GetAllTasksUseCase';
export { GetNoteTasksUseCase } from './GetNoteTasksUseCase';
export { UpdateTaskStateUseCase } from './UpdateTaskStateUseCase';
export { ToggleTaskUseCase } from './ToggleTaskUseCase';

export interface TaskUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  pathService: IPathService;
}

export function createTaskUseCases(deps: TaskUseCasesDeps): ITaskUseCases {
  const getAllTasks = new GetAllTasksUseCase(deps);
  const getNoteTasks = new GetNoteTasksUseCase(deps);
  const updateTaskState = new UpdateTaskStateUseCase(deps);
  const toggleTask = new ToggleTaskUseCase(getNoteTasks, updateTaskState);

  return {
    getAllTasks,
    getNoteTasks,
    updateTaskState,
    toggleTask,
  };
}
