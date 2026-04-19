import { EVENTS } from '@shared/constants/ipcChannels';
import {
  NotebookEntity,
  type INotebookRepository,
  type IMoveNotebookUseCase,
  type MoveNotebookRequest,
  NotebookNotFoundError,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class MoveNotebookUseCase implements IMoveNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: MoveNotebookRequest): Promise<void> {
    const notebookProps = await this.notebookRepository.findById(request.id);
    if (!notebookProps) {
      throw new NotebookNotFoundError(request.id);
    }

    const notebook = NotebookEntity.fromPersistence(notebookProps);
    notebook.moveTo(request.targetParentId);
    await this.notebookRepository.save(notebook);

    this.eventPublisher?.emit(EVENTS.NOTEBOOK_UPDATED, { notebook: notebook.toPersistence() });
  }
}
