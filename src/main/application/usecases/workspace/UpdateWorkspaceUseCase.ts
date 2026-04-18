import { EVENTS } from '@shared/constants/ipcChannels';
import {
  WorkspaceEntity,
  type IWorkspaceRepository,
  type IUpdateWorkspaceUseCase,
  type UpdateWorkspaceRequest,
  type UpdateWorkspaceResponse,
  WorkspaceNotFoundError,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class UpdateWorkspaceUseCase implements IUpdateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: UpdateWorkspaceRequest): Promise<UpdateWorkspaceResponse> {
    const workspaceProps = await this.workspaceRepository.findById(request.id);
    if (!workspaceProps) {
      throw new WorkspaceNotFoundError(request.id);
    }

    const workspace = WorkspaceEntity.fromPersistence(workspaceProps);

    if (request.name) {
      workspace.rename(request.name);
    }

    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.emit(EVENTS.WORKSPACE_UPDATED, { workspace: workspace.toPersistence() });

    return { workspace: workspace.toPersistence() };
  }
}
