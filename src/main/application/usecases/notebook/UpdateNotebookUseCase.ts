import { EVENTS } from '@shared/constants/ipcChannels';
import {
  NotebookEntity,
  type INotebookRepository,
  type IUpdateNotebookUseCase,
  type UpdateNotebookRequest,
  type UpdateNotebookResponse,
  NotebookNotFoundError,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class UpdateNotebookUseCase implements IUpdateNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: UpdateNotebookRequest): Promise<UpdateNotebookResponse> {
    const notebookProps = await this.notebookRepository.findById(request.id);
    if (!notebookProps) {
      throw new NotebookNotFoundError(request.id);
    }

    const notebook = NotebookEntity.fromPersistence(notebookProps);

    if (request.name !== undefined) {
      notebook.rename(request.name);
    }
    if (request.parentId !== undefined) {
      notebook.moveTo(request.parentId);
    }
    if (request.icon !== undefined) {
      notebook.changeIcon(request.icon);
    }
    if (request.color !== undefined) {
      notebook.changeColor(request.color);
    }

    await this.notebookRepository.save(notebook);

    this.eventPublisher?.emit(EVENTS.NOTEBOOK_UPDATED, { notebook: notebook.toPersistence() });

    return { notebook: notebook.toPersistence() };
  }
}
