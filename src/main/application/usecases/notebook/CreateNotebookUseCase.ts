import { generateId } from '@shared/utils/id';
import {
  NotebookEntity,
  type INotebookRepository,
  type ICreateNotebookUseCase,
  type CreateNotebookRequest,
  type CreateNotebookResponse,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class CreateNotebookUseCase implements ICreateNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: CreateNotebookRequest): Promise<CreateNotebookResponse> {
    const notebook = NotebookEntity.create({
      id: generateId(),
      name: request.name,
      parentId: request.parentId,
      workspaceId: request.workspaceId,
      folderPath: request.folderPath,
      icon: request.icon,
      color: request.color,
    });

    await this.notebookRepository.save(notebook);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTEBOOK_CREATED,
      timestamp: new Date(),
      payload: { notebook: notebook.toPersistence() },
    });

    return { notebook: notebook.toPersistence() };
  }
}
