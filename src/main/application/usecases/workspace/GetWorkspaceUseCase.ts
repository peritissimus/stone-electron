import {
  type IWorkspaceRepository,
  type IGetWorkspaceUseCase,
  type GetWorkspaceRequest,
  type GetWorkspaceResponse,
  WorkspaceNotFoundError,
} from '../../../domain';

export class GetWorkspaceUseCase implements IGetWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(request: GetWorkspaceRequest): Promise<GetWorkspaceResponse> {
    const workspaceProps = await this.workspaceRepository.findById(request.id);
    if (!workspaceProps) {
      throw new WorkspaceNotFoundError(request.id);
    }

    return { workspace: workspaceProps };
  }
}
