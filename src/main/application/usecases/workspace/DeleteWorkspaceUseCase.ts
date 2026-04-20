import {
  type IWorkspaceRepository,
  type IDeleteWorkspaceUseCase,
  type DeleteWorkspaceRequest,
  WorkspaceNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class DeleteWorkspaceUseCase implements IDeleteWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: DeleteWorkspaceRequest): Promise<void> {
    const exists = await this.workspaceRepository.exists(request.id);
    if (!exists) {
      throw new WorkspaceNotFoundError(request.id);
    }

    await this.workspaceRepository.delete(request.id);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.WORKSPACE_DELETED,
      timestamp: new Date(),
      payload: { id: request.id },
    });
  }
}
