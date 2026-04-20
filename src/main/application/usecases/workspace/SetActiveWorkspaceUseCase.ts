import {
  WorkspaceEntity,
  type IWorkspaceRepository,
  type ISetActiveWorkspaceUseCase,
  type SetActiveWorkspaceRequest,
  type SetActiveWorkspaceResponse,
  WorkspaceNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class SetActiveWorkspaceUseCase implements ISetActiveWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: SetActiveWorkspaceRequest): Promise<SetActiveWorkspaceResponse> {
    const workspaceProps = await this.workspaceRepository.findById(request.id);
    if (!workspaceProps) {
      throw new WorkspaceNotFoundError(request.id);
    }

    // Deactivate all workspaces
    const allWorkspaces = await this.workspaceRepository.findAll();
    for (const ws of allWorkspaces) {
      if (ws.isActive && ws.id !== request.id) {
        const entity = WorkspaceEntity.fromPersistence(ws);
        entity.deactivate();
        await this.workspaceRepository.save(entity);
      }
    }

    // Activate the requested workspace
    const workspace = WorkspaceEntity.fromPersistence(workspaceProps);
    workspace.activate();
    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.WORKSPACE_ACTIVATED,
      timestamp: new Date(),
      payload: { workspace: workspace.toPersistence() },
    });

    return { workspace: workspace.toPersistence() };
  }
}
