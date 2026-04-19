import {
  type NotebookProps,
  type NotebookWithCount,
  type INotebookRepository,
  type IListNotebooksUseCase,
  type ListNotebooksRequest,
  type ListNotebooksResponse,
} from '../../../domain';

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
