/**
 * Notebook Use Cases
 *
 * Application layer implementations for notebook operations.
 */

import { generateId } from '@shared/utils/id';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  NotebookEntity,
  type NotebookProps,
  type NotebookWithCount,
  type INotebookRepository,
  type INotebookUseCases,
  type ICreateNotebookUseCase,
  type IUpdateNotebookUseCase,
  type IGetNotebookUseCase,
  type IListNotebooksUseCase,
  type IDeleteNotebookUseCase,
  type IMoveNotebookUseCase,
  type CreateNotebookRequest,
  type CreateNotebookResponse,
  type UpdateNotebookRequest,
  type UpdateNotebookResponse,
  type GetNotebookRequest,
  type GetNotebookResponse,
  type ListNotebooksRequest,
  type ListNotebooksResponse,
  type DeleteNotebookRequest,
  type MoveNotebookRequest,
  NotebookNotFoundError,
} from '../../domain';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';

// ============================================================================
// Use Case Implementations
// ============================================================================

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

    this.eventPublisher?.emit(EVENTS.NOTEBOOK_CREATED, { notebook: notebook.toPersistence() });

    return { notebook: notebook.toPersistence() };
  }
}

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

export class GetNotebookUseCase implements IGetNotebookUseCase {
  constructor(private readonly notebookRepository: INotebookRepository) {}

  async execute(request: GetNotebookRequest): Promise<GetNotebookResponse> {
    const notebookProps = await this.notebookRepository.findById(request.id);
    if (!notebookProps) {
      throw new NotebookNotFoundError(request.id);
    }

    return { notebook: notebookProps };
  }
}

export class ListNotebooksUseCase implements IListNotebooksUseCase {
  constructor(private readonly notebookRepository: INotebookRepository) {}

  async execute(request: ListNotebooksRequest): Promise<ListNotebooksResponse> {
    const includeNoteCount = request.includeNoteCount ?? false;

    if (includeNoteCount) {
      const notebooks: NotebookWithCount[] = await this.notebookRepository.findAllWithCounts(
        request.workspaceId,
      );
      return { notebooks };
    }

    let notebooks: NotebookProps[];

    if (request.parentId !== undefined) {
      notebooks = await this.notebookRepository.findByParentId(
        request.parentId,
        request.workspaceId,
      );
    } else if (request.workspaceId) {
      notebooks = await this.notebookRepository.findByWorkspaceId(request.workspaceId);
    } else {
      notebooks = await this.notebookRepository.findAll();
    }

    return { notebooks: notebooks as NotebookProps[] };
  }
}

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

// ============================================================================
// Factory
// ============================================================================

export interface NotebookUseCasesDeps {
  notebookRepository: INotebookRepository;
  eventPublisher?: IEventPublisher;
}

export function createNotebookUseCases(deps: NotebookUseCasesDeps): INotebookUseCases {
  const { notebookRepository, eventPublisher } = deps;

  return {
    createNotebook: new CreateNotebookUseCase(notebookRepository, eventPublisher),
    updateNotebook: new UpdateNotebookUseCase(notebookRepository, eventPublisher),
    getNotebook: new GetNotebookUseCase(notebookRepository),
    listNotebooks: new ListNotebooksUseCase(notebookRepository),
    deleteNotebook: new DeleteNotebookUseCase(notebookRepository, eventPublisher),
    moveNotebook: new MoveNotebookUseCase(notebookRepository, eventPublisher),
  };
}
