import type { INotebookRepository, INotebookUseCases } from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import { CreateNotebookUseCase } from './CreateNotebookUseCase';
import { UpdateNotebookUseCase } from './UpdateNotebookUseCase';
import { GetNotebookUseCase } from './GetNotebookUseCase';
import { ListNotebooksUseCase } from './ListNotebooksUseCase';
import { DeleteNotebookUseCase } from './DeleteNotebookUseCase';
import { MoveNotebookUseCase } from './MoveNotebookUseCase';

export { CreateNotebookUseCase } from './CreateNotebookUseCase';
export { UpdateNotebookUseCase } from './UpdateNotebookUseCase';
export { GetNotebookUseCase } from './GetNotebookUseCase';
export { ListNotebooksUseCase } from './ListNotebooksUseCase';
export { DeleteNotebookUseCase } from './DeleteNotebookUseCase';
export { MoveNotebookUseCase } from './MoveNotebookUseCase';

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
