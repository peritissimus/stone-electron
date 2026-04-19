import { EVENTS } from '@shared/constants/ipcChannels';
import {
  type INotebookRepository,
  type IDeleteNotebookUseCase,
  type DeleteNotebookRequest,
  NotebookNotFoundError,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class DeleteNotebookUseCase implements IDeleteNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: DeleteNotebookRequest): Promise<void> {
    const exists = await this.notebookRepository.exists(request.id);
    if (!exists) {
      throw new NotebookNotFoundError(request.id);
    }

    await this.notebookRepository.delete(request.id);

    this.eventPublisher?.emit(EVENTS.NOTEBOOK_DELETED, { id: request.id });
  }
}
