import {
  WorkspaceEntity,
  type IWorkspaceRepository,
  type ICreateWorkspaceUseCase,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type IIdGenerator,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class CreateWorkspaceUseCase implements ICreateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly fileStorage: IFileStorage,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse> {
    // Ensure the target folder exists. The native picker guarantees this for
    // user-selected folders, but onboarding may pass a suggested default
    // (e.g. ~/Documents/Stone) that hasn't been created yet. Recursive mkdir
    // is idempotent, so this is a no-op for existing folders.
    await this.fileStorage.createDirectory(request.folderPath);

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
