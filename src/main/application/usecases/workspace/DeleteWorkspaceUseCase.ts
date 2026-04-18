import { EVENTS } from '@shared/constants/ipcChannels';
import {
  type IWorkspaceRepository,
  type IDeleteWorkspaceUseCase,
  type DeleteWorkspaceRequest,
  WorkspaceNotFoundError,
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

    this.eventPublisher?.emit(EVENTS.WORKSPACE_DELETED, { id: request.id });
  }
}
