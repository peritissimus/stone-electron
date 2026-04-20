import {
  type INotebookRepository,
  type IDeleteNotebookUseCase,
  type DeleteNotebookRequest,
  NotebookNotFoundError,
  DOMAIN_EVENT_TYPES,
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

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTEBOOK_DELETED,
      timestamp: new Date(),
      payload: { id: request.id },
    });
  }
}
