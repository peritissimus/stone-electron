import {
  type IWorkspaceRepository,
  type IListWorkspacesUseCase,
  type ListWorkspacesResponse,
} from '../../../domain';

export class ListWorkspacesUseCase implements IListWorkspacesUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(): Promise<ListWorkspacesResponse> {
    const workspaces = await this.workspaceRepository.findAll();
    return { workspaces };
  }
}
