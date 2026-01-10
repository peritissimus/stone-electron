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
  type INotebookRepository,
  NotebookNotFoundError,
} from '../../domain';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';

// ============================================================================
// Use Case Implementations
// ============================================================================

export class CreateNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    name: string;
    parentId?: string;
    workspaceId?: string;
    folderPath?: string;
    icon?: string;
    color?: string;
  }): Promise<{ notebook: NotebookProps }> {
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

export class UpdateNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    id: string;
    name?: string;
    parentId?: string;
    icon?: string;
    color?: string;
  }): Promise<{ notebook: NotebookProps }> {
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

export class GetNotebookUseCase {
  constructor(private readonly notebookRepository: INotebookRepository) {}

  async execute(request: { id: string }): Promise<{ notebook: NotebookProps }> {
    const notebookProps = await this.notebookRepository.findById(request.id);
    if (!notebookProps) {
      throw new NotebookNotFoundError(request.id);
    }

    return { notebook: notebookProps };
  }
}

export class ListNotebooksUseCase {
  constructor(private readonly notebookRepository: INotebookRepository) {}

  async execute(request: {
    workspaceId?: string;
    parentId?: string | null;
  }): Promise<{ notebooks: NotebookProps[] }> {
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

    return { notebooks };
  }
}

export class DeleteNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string }): Promise<void> {
    const exists = await this.notebookRepository.exists(request.id);
    if (!exists) {
      throw new NotebookNotFoundError(request.id);
    }

    await this.notebookRepository.delete(request.id);

    this.eventPublisher?.emit(EVENTS.NOTEBOOK_DELETED, { id: request.id });
  }
}

export class MoveNotebookUseCase {
  constructor(
    private readonly notebookRepository: INotebookRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string; targetParentId: string | null }): Promise<void> {
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

export interface INotebookUseCases {
  createNotebook: CreateNotebookUseCase;
  updateNotebook: UpdateNotebookUseCase;
  getNotebook: GetNotebookUseCase;
  listNotebooks: ListNotebooksUseCase;
  deleteNotebook: DeleteNotebookUseCase;
  moveNotebook: MoveNotebookUseCase;
}

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
