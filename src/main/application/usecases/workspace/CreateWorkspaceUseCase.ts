import { generateId } from '@shared/utils/id';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  WorkspaceEntity,
  type IWorkspaceRepository,
  type ICreateWorkspaceUseCase,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class CreateWorkspaceUseCase implements ICreateWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse> {
    const workspace = WorkspaceEntity.create({
      id: generateId(),
      name: request.name,
      folderPath: request.folderPath,
      isActive: false,
    });

    await this.workspaceRepository.save(workspace);

    this.eventPublisher?.emit(EVENTS.WORKSPACE_CREATED, { workspace: workspace.toPersistence() });

    return { workspace: workspace.toPersistence() };
  }
}
