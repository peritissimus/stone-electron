import type {
  IGetNoteTasksUseCase,
  IToggleTaskUseCase,
  IUpdateTaskStateUseCase,
} from '../../../domain/ports/in/ITaskUseCases';
import type { TaskState } from '../../../domain/services/TaskExtractor';

/**
 * Toggle a task between TODO and DONE
 */
export class ToggleTaskUseCase implements IToggleTaskUseCase {
  constructor(
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
