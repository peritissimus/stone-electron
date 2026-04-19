import {
  type INotebookRepository,
  type IGetNotebookUseCase,
  type GetNotebookRequest,
  type GetNotebookResponse,
  NotebookNotFoundError,
} from '../../../domain';

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
