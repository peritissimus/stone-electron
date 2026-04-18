import {
  type WorkspaceProps,
  type IWorkspaceRepository,
  type IGetActiveWorkspaceUseCase,
} from '../../../domain';

export class GetActiveWorkspaceUseCase implements IGetActiveWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(): Promise<{ workspace: WorkspaceProps | null }> {
    const workspace = await this.workspaceRepository.findActive();
    return { workspace };
  }
}
