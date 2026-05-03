import {
  WorkspaceEntity,
  type IWorkspaceRepository,
  type ICreateWorkspaceUseCase,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type IIdGenerator,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class CreateWorkspaceUseCase implements ICreateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse> {
    const workspace = WorkspaceEntity.create({
      id: this.idGenerator.generate(),
      name: request.name,
      folderPath: request.folderPath,
      isActive: false,
    });

    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.WORKSPACE_CREATED,
      timestamp: new Date(),
      payload: { workspace: workspace.toPersistence() },
    });

    return { workspace: workspace.toPersistence() };
  }
}
