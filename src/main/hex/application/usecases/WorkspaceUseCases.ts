/**
 * Workspace Use Cases
 *
 * Application layer implementations for workspace operations.
 */

import { generateId } from '@shared/utils/id';
import {
  WorkspaceEntity,
  type WorkspaceProps,
  type IWorkspaceRepository,
  WorkspaceNotFoundError,
} from '../../domain';

// ============================================================================
// Use Case Implementations
// ============================================================================

export class CreateWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(request: {
    name: string;
    folderPath: string;
  }): Promise<{ workspace: WorkspaceProps }> {
    const workspace = WorkspaceEntity.create({
      id: generateId(),
      name: request.name,
      folderPath: request.folderPath,
      isActive: false,
    });

    await this.workspaceRepository.save(workspace);

    return { workspace: workspace.toPersistence() };
  }
}

export class GetWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(request: { id: string }): Promise<{ workspace: WorkspaceProps }> {
    const workspaceProps = await this.workspaceRepository.findById(request.id);
    if (!workspaceProps) {
      throw new WorkspaceNotFoundError(request.id);
    }

    return { workspace: workspaceProps };
  }
}

export class ListWorkspacesUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(): Promise<{ workspaces: WorkspaceProps[] }> {
    const workspaces = await this.workspaceRepository.findAll();
    return { workspaces };
  }
}

export class SetActiveWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(request: { id: string }): Promise<{ workspace: WorkspaceProps }> {
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

    return { workspace: workspace.toPersistence() };
  }
}

export class GetActiveWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(): Promise<{ workspace: WorkspaceProps | null }> {
    const workspace = await this.workspaceRepository.findActive();
    return { workspace };
  }
}

export class DeleteWorkspaceUseCase {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async execute(request: { id: string }): Promise<void> {
    const exists = await this.workspaceRepository.exists(request.id);
    if (!exists) {
      throw new WorkspaceNotFoundError(request.id);
    }

    await this.workspaceRepository.delete(request.id);
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface IWorkspaceUseCases {
  createWorkspace: CreateWorkspaceUseCase;
  getWorkspace: GetWorkspaceUseCase;
  listWorkspaces: ListWorkspacesUseCase;
  setActiveWorkspace: SetActiveWorkspaceUseCase;
  getActiveWorkspace: GetActiveWorkspaceUseCase;
  deleteWorkspace: DeleteWorkspaceUseCase;
}

export function createWorkspaceUseCases(
  workspaceRepository: IWorkspaceRepository
): IWorkspaceUseCases {
  return {
    createWorkspace: new CreateWorkspaceUseCase(workspaceRepository),
    getWorkspace: new GetWorkspaceUseCase(workspaceRepository),
    listWorkspaces: new ListWorkspacesUseCase(workspaceRepository),
    setActiveWorkspace: new SetActiveWorkspaceUseCase(workspaceRepository),
    getActiveWorkspace: new GetActiveWorkspaceUseCase(workspaceRepository),
    deleteWorkspace: new DeleteWorkspaceUseCase(workspaceRepository),
  };
}
